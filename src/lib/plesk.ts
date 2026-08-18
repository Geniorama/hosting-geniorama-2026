import https from "node:https";
import type { Order } from "./order-store";
import {
  classifyProvisionError,
  deriveUsername,
  generatePassword,
  type HostingAccountResult,
} from "./hosting-account";

/**
 * Plesk reseller provisioning — the secondary provider.
 *
 * The primary reseller (cPanel/WHM, see ./whm.ts) is tried first; when it is
 * full, `provisionIfNeeded` falls back here.
 *
 * ── PENDING CONFIRMATION WITH THE PROVIDER ──────────────────────────────────
 * Which of the two modes below actually works depends on what the provider
 * enables for a reseller account, so both are implemented and selected with
 * PLESK_PROVISION_MODE:
 *
 *   "cli"  (default) — POST /api/v2/cli/subscription/call, i.e. the REST API
 *          proxying `plesk bin subscription --create`. Most complete: it sets
 *          the login and password in one shot. Usually requires admin rights,
 *          which some providers do not grant to resellers.
 *   "rest" — POST /api/v2/clients then POST /api/v2/domains. Works with plain
 *          reseller permissions, but the accepted body varies between Plesk
 *          versions (`plan` vs `service_plan`, `owner_client` vs `owner`).
 *
 * Use `pleskProbe()` (exposed at /api/dev/plesk-check) to find out which one
 * these credentials can actually reach before switching the fallback on.
 */

type PleskMode = "cli" | "rest";

function tryEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

export function isPleskConfigured(): boolean {
  if (!tryEnv("PLESK_API_URL")) return false;
  return Boolean(
    tryEnv("PLESK_API_KEY") || (tryEnv("PLESK_API_USER") && tryEnv("PLESK_API_PASSWORD")),
  );
}

/**
 * Plan → Plesk service plan name. Left empty until the provider's plan names
 * are known; PLESK_SERVICE_PLAN covers every plan in the meantime. Mirrors
 * `planToPackage` in ./whm.ts — names are case-sensitive.
 */
const planToServicePlan: Record<string, string> = {};

export function servicePlanForPlan(planId: string): string | undefined {
  return planToServicePlan[planId] ?? tryEnv("PLESK_SERVICE_PLAN");
}

/** Nameservers of the Plesk provider, for the credentials email. */
export function pleskNameservers(): { ns1?: string; ns2?: string } {
  return { ns1: tryEnv("PLESK_NS1"), ns2: tryEnv("PLESK_NS2") };
}

/**
 * Panel URL to show the customer. Prefer the provider's server hostname — it
 * has a valid certificate and works before the domain resolves. Without it the
 * email falls back to https://<domain>:8443.
 */
export function pleskPanelUrl(): string | undefined {
  return tryEnv("PLESK_PANEL_URL");
}

function authHeaders(): Record<string, string> {
  const key = tryEnv("PLESK_API_KEY");
  if (key) return { "X-API-Key": key };
  const user = tryEnv("PLESK_API_USER") ?? "";
  const password = tryEnv("PLESK_API_PASSWORD") ?? "";
  const basic = Buffer.from(`${user}:${password}`).toString("base64");
  return { Authorization: `Basic ${basic}` };
}

type PleskResponse = { status: number; json: unknown; text: string };

/**
 * Plesk listens on :8443 and frequently with a self-signed certificate, which
 * Node's global fetch rejects outright with an opaque error. node:https lets us
 * opt out for these requests only (PLESK_ALLOW_SELF_SIGNED=true) instead of
 * disabling TLS verification process-wide with NODE_TLS_REJECT_UNAUTHORIZED=0.
 */
function pleskRequest(path: string, body?: unknown, method = "POST"): Promise<PleskResponse> {
  const raw = tryEnv("PLESK_API_URL");
  if (!raw) return Promise.reject(new Error("Missing env var: PLESK_API_URL"));

  let base: URL;
  try {
    base = new URL(raw);
  } catch {
    return Promise.reject(new Error(`PLESK_API_URL is not a valid URL: ${raw}`));
  }
  if (base.protocol !== "https:") {
    return Promise.reject(new Error(`PLESK_API_URL must be https (got ${base.protocol})`));
  }

  const payload = body === undefined ? undefined : JSON.stringify(body);

  return new Promise<PleskResponse>((resolve, reject) => {
    const req = https.request(
      {
        hostname: base.hostname,
        port: base.port || "8443",
        path: `${base.pathname.replace(/\/$/, "")}${path}`,
        method,
        rejectUnauthorized: tryEnv("PLESK_ALLOW_SELF_SIGNED") !== "true",
        timeout: 30_000,
        headers: {
          Accept: "application/json",
          ...authHeaders(),
          ...(payload
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
              }
            : {}),
        },
      },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          text += chunk;
        });
        res.on("end", () => {
          let json: unknown = null;
          try {
            json = JSON.parse(text);
          } catch {
            // Plesk returns HTML on some auth failures — keep the raw text.
          }
          resolve({ status: res.statusCode ?? 0, json, text });
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("Plesk request timed out after 30s")));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/** Best-effort human message out of a Plesk error body. */
function pleskErrorMessage(res: PleskResponse): string {
  const j = res.json as
    | { message?: string; error?: string; errors?: Array<{ message?: string }> }
    | null;
  const fromBody =
    j?.message ??
    j?.error ??
    j?.errors
      ?.map((e) => e.message)
      .filter(Boolean)
      .join("; ");
  return `Plesk HTTP ${res.status}: ${fromBody || res.text.slice(0, 200) || "no body"}`;
}

type CliResult = { code?: number; stdout?: string; stderr?: string };

async function createViaCli(args: {
  domain: string;
  username: string;
  password: string;
  servicePlan: string;
}): Promise<HostingAccountResult> {
  const params = [
    "--create",
    args.domain,
    "-service-plan",
    args.servicePlan,
    "-login",
    args.username,
    "-passwd",
    args.password,
    "-notify",
    "false",
  ];
  const owner = tryEnv("PLESK_OWNER");
  if (owner) params.push("-owner", owner);
  const ip = tryEnv("PLESK_IP");
  if (ip) params.push("-ip", ip);

  const res = await pleskRequest("/api/v2/cli/subscription/call", { params });
  if (res.status >= 400) {
    const error = pleskErrorMessage(res);
    return { ok: false, error, code: classifyProvisionError(error), raw: res.json ?? res.text };
  }

  const out = res.json as CliResult | null;
  if (!out || out.code !== 0) {
    const error = `Plesk CLI exit ${out?.code ?? "?"}: ${
      out?.stderr?.trim() || out?.stdout?.trim() || res.text.slice(0, 200)
    }`;
    return { ok: false, error, code: classifyProvisionError(error), raw: res.json ?? res.text };
  }

  return {
    ok: true,
    username: args.username,
    domain: args.domain,
    password: args.password,
    package: args.servicePlan,
    ip,
    raw: res.json,
  };
}

async function createViaRest(args: {
  domain: string;
  username: string;
  password: string;
  servicePlan: string;
  contactName: string;
  contactEmail: string;
}): Promise<HostingAccountResult> {
  const client = await pleskRequest("/api/v2/clients", {
    name: args.contactName,
    login: args.username,
    passwd: args.password,
    email: args.contactEmail,
  });
  if (client.status >= 400) {
    const error = `${pleskErrorMessage(client)} (creating client)`;
    return {
      ok: false,
      error,
      code: classifyProvisionError(error),
      raw: client.json ?? client.text,
    };
  }
  const clientId = (client.json as { id?: number } | null)?.id;
  if (typeof clientId !== "number") {
    return {
      ok: false,
      error: `Plesk client created but no id came back: ${client.text.slice(0, 200)}`,
      code: "unknown",
      raw: client.json ?? client.text,
    };
  }

  const ip = tryEnv("PLESK_IP");
  const domain = await pleskRequest("/api/v2/domains", {
    name: args.domain,
    hosting_type: "virtual",
    owner_client: { id: clientId },
    plan: { name: args.servicePlan },
    ...(ip ? { ipv4: [ip] } : {}),
  });
  if (domain.status >= 400) {
    const error = `${pleskErrorMessage(domain)} (creating subscription)`;
    return {
      ok: false,
      error,
      code: classifyProvisionError(error),
      raw: domain.json ?? domain.text,
    };
  }

  return {
    ok: true,
    username: args.username,
    domain: args.domain,
    password: args.password,
    package: args.servicePlan,
    ip,
    raw: { client: client.json, domain: domain.json },
  };
}

export async function createPleskAccount(order: Order): Promise<HostingAccountResult> {
  if (!isPleskConfigured()) {
    return {
      ok: false,
      error:
        "Plesk provider not configured (needs PLESK_API_URL + PLESK_API_KEY or PLESK_API_USER/PLESK_API_PASSWORD)",
      code: "config",
    };
  }

  const servicePlan = servicePlanForPlan(order.payload.planId);
  if (!servicePlan) {
    return {
      ok: false,
      error: `No Plesk service plan mapped for plan "${order.payload.planId}" (set PLESK_SERVICE_PLAN)`,
      code: "config",
    };
  }

  const domain = order.payload.hosting.domain;
  const username = deriveUsername(domain);
  const password = generatePassword();
  const mode: PleskMode = tryEnv("PLESK_PROVISION_MODE") === "rest" ? "rest" : "cli";

  console.log("[plesk] creating subscription", { order: order.id, domain, servicePlan, mode });

  try {
    if (mode === "rest") {
      return await createViaRest({
        domain,
        username,
        password,
        servicePlan,
        contactName:
          order.payload.invoice.legalName ||
          `${order.payload.contact.firstName} ${order.payload.contact.lastName}`.trim(),
        contactEmail: order.payload.invoice.email || order.payload.contact.email,
      });
    }
    return await createViaCli({ domain, username, password, servicePlan });
  } catch (err) {
    return { ok: false, error: `Plesk unreachable: ${(err as Error).message}`, code: "unknown" };
  }
}

/**
 * Connectivity/permission probe. Answers the two questions we need from the
 * provider without creating anything: do the credentials authenticate, and is
 * the CLI endpoint reachable for them?
 */
export async function pleskProbe(): Promise<{
  configured: boolean;
  mode: PleskMode;
  servicePlan: string | null;
  auth: { ok: boolean; detail: string };
  cli: { ok: boolean; detail: string };
}> {
  const mode: PleskMode = tryEnv("PLESK_PROVISION_MODE") === "rest" ? "rest" : "cli";
  const base = {
    configured: isPleskConfigured(),
    mode,
    servicePlan: tryEnv("PLESK_SERVICE_PLAN") ?? null,
  };
  if (!base.configured) {
    const detail =
      "PLESK_API_URL and PLESK_API_KEY (or PLESK_API_USER/PLESK_API_PASSWORD) are not set";
    return { ...base, auth: { ok: false, detail }, cli: { ok: false, detail } };
  }

  let auth: { ok: boolean; detail: string };
  try {
    const res = await pleskRequest("/api/v2/server", undefined, "GET");
    auth =
      res.status === 200
        ? { ok: true, detail: res.text.slice(0, 300) }
        : { ok: false, detail: pleskErrorMessage(res) };
  } catch (err) {
    auth = { ok: false, detail: (err as Error).message };
  }

  let cli: { ok: boolean; detail: string };
  try {
    const res = await pleskRequest("/api/v2/cli/subscription/call", { params: ["--help"] });
    const out = res.json as CliResult | null;
    cli =
      res.status < 400 && out?.code === 0
        ? { ok: true, detail: (out.stdout ?? "").slice(0, 300) }
        : { ok: false, detail: pleskErrorMessage(res) };
  } catch (err) {
    cli = { ok: false, detail: (err as Error).message };
  }

  return { ...base, auth, cli };
}
