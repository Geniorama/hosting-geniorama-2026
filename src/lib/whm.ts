import { orderStore, type Order } from "./order-store";
import {
  sendCpanelCredentials,
  sendProvisioningDelayedNotice,
  sendProvisioningFailureAlert,
  type CredentialsPresentation,
} from "./mail-templates";
import {
  classifyProvisionError,
  deriveUsername,
  generatePassword,
  type HostingAccountResult,
  type PanelType,
} from "./hosting-account";
import {
  createPleskAccount,
  isPleskConfigured,
  pleskNameservers,
  pleskPanelUrl,
} from "./plesk";
import { syncOrderToTickets } from "./tickets-integration";
import { createInvoiceCard } from "./trello";

export { deriveUsername, generatePassword };

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function tryEnv(name: string): string | undefined {
  return process.env[name];
}

// Real WHM package names (case-sensitive, exactly as they appear in /listpkgs).
const planToPackage: Record<string, string> = {
  starter: "genioram_Starter",
  basic: "genioram_Basic",
  standar: "genioram_Standar",
  news: "genioram_News Page",
  mega: "genioram_Mega News Page",
  "ads-basic": "genioram_Ads_Basic",
  "ads-landing": "genioram_Ads_Landing_Page",
  "ads-advanced": "genioram_Ads Advanced", // note the space
};

export function packageForPlan(planId: string): string {
  return planToPackage[planId] ?? tryEnv("WHM_DEFAULT_PACKAGE") ?? "default";
}

/**
 * Alias kept because mail-templates, tickets-integration and the admin routes
 * type against this name. The shape is provider-agnostic now — a Plesk account
 * comes back in exactly the same envelope.
 */
export type WhmCreateAcctResult = HostingAccountResult;

type WhmRawResponse = {
  metadata?: { result?: 0 | 1; reason?: string };
  data?: { ip?: string; [k: string]: unknown };
  result?: Array<{ status: 0 | 1; statusmsg?: string }>;
};

export async function createCpanelAccount(order: Order): Promise<WhmCreateAcctResult> {
  const apiUrl = getEnv("WHM_API_URL").replace(/\/$/, "");
  const apiUser = getEnv("WHM_API_USER");
  const apiToken = getEnv("WHM_API_TOKEN");

  const domain = order.payload.hosting.domain;
  const username = deriveUsername(domain);
  const password = generatePassword();
  const pkg = packageForPlan(order.payload.planId);
  const contactEmail = order.payload.invoice.email || order.payload.contact.email;

  const params = new URLSearchParams({
    "api.version": "1",
    username,
    domain,
    password,
    contactemail: contactEmail,
    plan: pkg,
    quota: "0",
    cgi: "1",
    hasshell: "0",
    cpmod: "jupiter",
  });

  const url = `${apiUrl}/json-api/createacct?${params.toString()}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `whm ${apiUser}:${apiToken}`,
      },
      cache: "no-store",
    });
  } catch (err) {
    return {
      ok: false,
      error: `WHM unreachable: ${(err as Error).message}`,
      code: "unknown",
    };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const error = `WHM HTTP ${res.status}: ${body.slice(0, 200)}`;
    return { ok: false, error, code: classifyProvisionError(error) };
  }

  const json = (await res.json().catch(() => null)) as WhmRawResponse | null;
  if (!json) return { ok: false, error: "WHM returned non-JSON response", code: "unknown" };

  const success =
    json.metadata?.result === 1 || json.result?.[0]?.status === 1;

  if (!success) {
    const reason =
      json.metadata?.reason ?? json.result?.[0]?.statusmsg ?? "Unknown WHM error";
    return { ok: false, error: reason, code: classifyProvisionError(reason), raw: json };
  }

  return {
    ok: true,
    username,
    domain,
    password,
    package: pkg,
    ip: json.data?.ip,
    raw: json,
  };
}

/**
 * What to do when the primary (cPanel/WHM) reseller refuses the account.
 *
 *   "manual" (default) — do NOT call the Plesk API. When WHM says it is full,
 *                        email the team a work order to create the subscription
 *                        by hand in the Plesk reseller and finish it with
 *                        /api/admin/complete-order. This is the current mode
 *                        while the Plesk provider's API access is unresolved.
 *   "capacity"         — create it automatically in Plesk, but only when WHM
 *                        ran out of accounts or disk.
 *   "any"              — automatic on any error except a conflict (a domain or
 *                        login that already exists would clash there too, and
 *                        we would risk creating the account twice).
 *   "off"              — never mention Plesk; behaves as before it existed.
 *
 * Switch to "capacity" once /api/admin/plesk-check reports the credentials work.
 */
function fallbackMode(): "manual" | "capacity" | "any" | "off" {
  const v = process.env.PROVISION_FALLBACK_MODE?.trim().toLowerCase();
  return v === "capacity" || v === "any" || v === "off" ? v : "manual";
}

/** The team creates it in Plesk by hand; we just tell them, with the data. */
function shouldRequestManualPlesk(
  result: Extract<HostingAccountResult, { ok: false }>,
): boolean {
  return fallbackMode() === "manual" && result.code === "capacity";
}

function shouldAutoFallback(result: Extract<HostingAccountResult, { ok: false }>): boolean {
  const mode = fallbackMode();
  if (mode === "off" || mode === "manual") return false;
  if (mode === "any") return result.code !== "conflict";
  return result.code === "capacity";
}

/**
 * How the credentials email should describe a Plesk account. Unlike the manual
 * flow in /api/admin/complete-order — where the domain already pointed at the
 * reseller — a customer we auto-provision here still has to repoint their
 * domain, so the nameserver section stays in whenever we know the values.
 */
function pleskPresentation(): CredentialsPresentation {
  const { ns1, ns2 } = pleskNameservers();
  if (!ns1 || !ns2) {
    // Without them the customer gets no instructions for repointing the domain.
    console.warn("[plesk] PLESK_NS1/PLESK_NS2 not set — credentials email will omit nameservers");
  }
  return {
    panel: "plesk",
    ns1,
    ns2,
    panelUrl: pleskPanelUrl(),
    showNameservers: Boolean(ns1 && ns2),
  };
}

export async function provisionIfNeeded(order: Order): Promise<WhmCreateAcctResult | null> {
  if (order.provisioning) {
    console.log("[whm] order already provisioned, skipping", order.id);
    return null;
  }

  if (order.domainOwnership === "not-yet" || order.payload.hosting.domainOwnership === "not-yet") {
    console.log(
      "[whm] order awaiting domain registration, skipping auto-provisioning",
      order.id,
    );
    return null;
  }

  let result = await createCpanelAccount(order);
  let panel: PanelType = "cpanel";
  // Set when the alert should be a "create it in Plesk by hand" work order
  // rather than a generic provisioning failure.
  let manualPanel: PanelType | undefined;

  if (!result.ok) {
    console.error("[whm] createacct failed", {
      order: order.id,
      error: result.error,
      code: result.code ?? "unknown",
    });

    const primaryError = result.error;

    if (shouldRequestManualPlesk(result)) {
      manualPanel = "plesk";
      console.warn("[provision] primary reseller full — handing over to manual Plesk", order.id);
    } else if (!shouldAutoFallback(result)) {
      console.log("[provision] not falling back", {
        order: order.id,
        mode: fallbackMode(),
        code: result.code ?? "unknown",
      });
    } else if (!isPleskConfigured()) {
      console.warn("[provision] primary reseller is full but Plesk is not configured", order.id);
    } else {
      console.warn("[provision] primary reseller unavailable, falling back to Plesk", {
        order: order.id,
        code: result.code ?? "unknown",
      });

      const fallback = await createPleskAccount(order);
      if (fallback.ok) {
        result = fallback;
        panel = "plesk";
      } else {
        console.error("[plesk] fallback failed", { order: order.id, error: fallback.error });
        // Both resellers refused it — surface the two reasons in the ops alert.
        result = {
          ok: false,
          error: `cPanel: ${primaryError} · Plesk: ${fallback.error}`,
          code: fallback.code,
          raw: fallback.raw,
        };
      }
    }
  }

  if (!result.ok) {
    // Capa 1: alerta al equipo de soporte para activación manual.
    try {
      await sendProvisioningFailureAlert(
        order,
        result.error,
        manualPanel ? { manualPanel } : undefined,
      );
    } catch (err) {
      console.error("[whm] ops alert send failed", err);
    }

    // Capa 2: aviso al cliente de que su pago llegó y la cuenta se activa pronto.
    try {
      await sendProvisioningDelayedNotice(order);
    } catch (err) {
      console.error("[whm] delayed notice send failed", err);
    }

    return result;
  }

  await completeProvisioning(
    order,
    result,
    panel === "plesk" ? pleskPresentation() : undefined,
    { provider: panel === "plesk" ? "plesk" : "whm" },
  );

  return result;
}

/**
 * Runs every post-account-creation step (persist provisioning, send
 * credentials, sync to tickets, create the Trello invoice card) for an order
 * whose cPanel account already exists.
 *
 * `provisionIfNeeded` calls this after creating the account via WHM. It is also
 * exposed directly so an account created manually in another reseller (e.g.
 * when the primary reseller is full) can be wired up automatically without
 * hitting the WHM API — see /api/admin/complete-order.
 *
 * Each step is idempotent: tickets sync and the Trello card are skipped when
 * already recorded on the order.
 */
export async function completeProvisioning(
  order: Order,
  result: Extract<WhmCreateAcctResult, { ok: true }>,
  presentation?: CredentialsPresentation,
  flow?: { skipCredentialsEmail?: boolean; provider?: string },
): Promise<void> {
  const panel: PanelType = presentation?.panel ?? "cpanel";

  try {
    await orderStore.setProvisioning(order.id, {
      username: result.username,
      domain: result.domain,
      package: result.package,
      ip: result.ip,
      provisionedAt: Date.now(),
      panel,
      provider: flow?.provider ?? (panel === "plesk" ? "plesk" : "whm"),
    });
  } catch (err) {
    console.error("[whm] failed to persist provisioning info", err);
  }

  console.log("[provision] hosting account created", {
    order: order.id,
    username: result.username,
    domain: result.domain,
    panel,
  });

  if (flow?.skipCredentialsEmail) {
    console.log("[whm] skipping credentials email (skipCredentialsEmail)", order.id);
  } else {
    try {
      await sendCpanelCredentials(order, result, presentation);
    } catch (err) {
      console.error("[whm] credentials email failed", err);
    }
  }

  let orderForNext = order;

  if (!order.ticketsSync) {
    try {
      const sync = await syncOrderToTickets(order, result);
      if (sync.ok) {
        const info = {
          userId: sync.userId,
          companyId: sync.companyId,
          serviceId: sync.serviceId,
          planId: sync.planId,
          expiresAt: sync.expiresAt,
          syncedAt: Date.now(),
        };
        await orderStore.setTicketsSync(order.id, info);
        orderForNext = { ...orderForNext, ticketsSync: info };
        console.log("[tickets] order synced", {
          order: order.id,
          userId: sync.userId,
          serviceId: sync.serviceId,
          planId: sync.planId,
        });
      } else {
        console.error("[tickets] sync failed", { order: order.id, error: sync.error });
      }
    } catch (err) {
      console.error("[tickets] sync threw", err);
    }
  }

  if (!orderForNext.invoiceTask) {
    try {
      const card = await createInvoiceCard(orderForNext);
      if (card.ok) {
        await orderStore.setInvoiceTask(order.id, {
          provider: "trello",
          cardId: card.id,
          url: card.shortUrl,
          createdAt: Date.now(),
        });
        console.log("[trello] invoice card created", {
          order: order.id,
          card: card.shortUrl,
        });
      } else {
        console.error("[trello] card creation failed", {
          order: order.id,
          error: card.error,
        });
      }
    } catch (err) {
      console.error("[trello] card creation threw", err);
    }
  }
}

