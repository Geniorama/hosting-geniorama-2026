import crypto from "node:crypto";
import { orderStore, type Order } from "./order-store";
import {
  sendCpanelCredentials,
  sendProvisioningDelayedNotice,
  sendProvisioningFailureAlert,
} from "./mail-templates";
import { syncOrderToTickets } from "./tickets-integration";
import { createInvoiceCard } from "./trello";

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

export function deriveUsername(domain: string): string {
  const stem = domain.split(".")[0] ?? "user";
  const cleaned = stem.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const head = cleaned.slice(0, 7) || "user";
  const suffix = Math.floor(Math.random() * 10).toString();
  return `${head}${suffix}`.slice(0, 8);
}

export function generatePassword(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const symbols = "!@#$%^&*";
  const buf = crypto.randomBytes(16);
  let pwd = "";
  for (let i = 0; i < 14; i++) pwd += alphabet[buf[i] % alphabet.length];
  pwd += symbols[buf[14] % symbols.length];
  pwd += (buf[15] % 10).toString();
  return pwd;
}

export type WhmCreateAcctResult =
  | {
      ok: true;
      username: string;
      domain: string;
      password: string;
      package: string;
      ip?: string;
      raw: unknown;
    }
  | { ok: false; error: string; raw?: unknown };

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
    return { ok: false, error: `WHM unreachable: ${(err as Error).message}` };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `WHM HTTP ${res.status}: ${body.slice(0, 200)}` };
  }

  const json = (await res.json().catch(() => null)) as WhmRawResponse | null;
  if (!json) return { ok: false, error: "WHM returned non-JSON response" };

  const success =
    json.metadata?.result === 1 || json.result?.[0]?.status === 1;

  if (!success) {
    const reason =
      json.metadata?.reason ?? json.result?.[0]?.statusmsg ?? "Unknown WHM error";
    return { ok: false, error: reason, raw: json };
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

  const result = await createCpanelAccount(order);
  if (!result.ok) {
    console.error("[whm] createacct failed", { order: order.id, error: result.error });

    // Capa 1: alerta al equipo de soporte para activación manual.
    try {
      await sendProvisioningFailureAlert(order, result.error);
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

  try {
    await orderStore.setProvisioning(order.id, {
      username: result.username,
      domain: result.domain,
      package: result.package,
      ip: result.ip,
      provisionedAt: Date.now(),
    });
  } catch (err) {
    console.error("[whm] failed to persist provisioning info", err);
  }

  console.log("[whm] cPanel account created", {
    order: order.id,
    username: result.username,
    domain: result.domain,
  });

  try {
    await sendCpanelCredentials(order, result);
  } catch (err) {
    console.error("[whm] credentials email failed", err);
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

  return result;
}

