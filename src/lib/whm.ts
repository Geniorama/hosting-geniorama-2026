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
import { syncOrderToTickets } from "./tickets-integration";
import { createInvoiceCard } from "./trello";

export { deriveUsername, generatePassword };

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function tryEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

/**
 * A WHM reseller we can create cPanel accounts on.
 *
 * Both hosting providers run WHM, so the secondary reseller is this same
 * adapter with different credentials — only the package names, the nameservers
 * the customer has to point their domain at, and the panel hostname differ.
 */
export type WhmServer = {
  key: "primary" | "secondary";
  /** Human label for logs and ops emails. */
  label: string;
  apiUrl: string;
  apiUser: string;
  apiToken: string;
  /** Nameservers of THIS reseller, for the credentials email. */
  ns1?: string;
  ns2?: string;
  /**
   * Panel hostname with a valid certificate (e.g. https://srv2.proveedor.com:2083).
   * When set, the credentials email uses it instead of https://<domain>:2083, so
   * the customer can log in before DNS propagates.
   */
  panelUrl?: string;
};

export function primaryServer(): WhmServer {
  return {
    key: "primary",
    label: "reseller primario",
    apiUrl: getEnv("WHM_API_URL").replace(/\/$/, ""),
    apiUser: getEnv("WHM_API_USER"),
    apiToken: getEnv("WHM_API_TOKEN"),
    ns1: tryEnv("HOSTING_NS1"),
    ns2: tryEnv("HOSTING_NS2"),
    panelUrl: tryEnv("WHM_PANEL_URL"),
  };
}

/**
 * How to present an account that lives on the second reseller. Split out of
 * `secondaryServer` because the manual flow (/api/admin/complete-order) needs
 * these even when we have no API credentials for that server.
 */
export function secondaryDefaults(): { ns1?: string; ns2?: string; panelUrl?: string } {
  return {
    ns1: tryEnv("WHM2_NS1"),
    ns2: tryEnv("WHM2_NS2"),
    panelUrl: tryEnv("WHM2_PANEL_URL"),
  };
}

/** The second reseller, or undefined while its API credentials are not set. */
export function secondaryServer(): WhmServer | undefined {
  const apiUrl = tryEnv("WHM2_API_URL");
  const apiUser = tryEnv("WHM2_API_USER");
  const apiToken = tryEnv("WHM2_API_TOKEN");
  if (!apiUrl || !apiUser || !apiToken) return undefined;
  return {
    key: "secondary",
    label: "reseller secundario",
    apiUrl: apiUrl.replace(/\/$/, ""),
    apiUser,
    apiToken,
    ...secondaryDefaults(),
  };
}

export function isSecondaryConfigured(): boolean {
  return Boolean(secondaryServer());
}

// Real WHM package names of the primary reseller (case-sensitive, exactly as
// they appear in /listpkgs).
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

/**
 * WHM prefixes every package with the reseller username that owns it, so the
 * second reseller's names are different. Map them explicitly with
 * WHM2_PACKAGE_MAP ("starter=user2_Starter,basic=user2_Basic") or — if you
 * recreated the same plan names there — set WHM2_PACKAGE_PREFIX ("user2_") and
 * the suffixes above are reused. GET /api/admin/whm-check lists the real names.
 */
function secondaryPackageMap(): Record<string, string> {
  const raw = tryEnv("WHM2_PACKAGE_MAP");
  if (!raw) return {};
  const map: Record<string, string> = {};
  for (const entry of raw.split(",")) {
    const sep = entry.indexOf("=");
    if (sep < 1) continue;
    const plan = entry.slice(0, sep).trim();
    const pkg = entry.slice(sep + 1).trim();
    if (plan && pkg) map[plan] = pkg;
  }
  return map;
}

export function packageForPlan(
  planId: string,
  server?: { key: "primary" | "secondary" },
): string {
  const primary = planToPackage[planId];

  if (server?.key !== "secondary") {
    return primary ?? tryEnv("WHM_DEFAULT_PACKAGE") ?? "default";
  }

  const explicit = secondaryPackageMap()[planId];
  if (explicit) return explicit;

  const prefix = tryEnv("WHM2_PACKAGE_PREFIX");
  if (prefix && primary) return `${prefix}${primary.replace(/^[^_]*_/, "")}`;

  return tryEnv("WHM2_DEFAULT_PACKAGE") ?? primary ?? tryEnv("WHM_DEFAULT_PACKAGE") ?? "default";
}

/**
 * Alias kept because mail-templates, tickets-integration and the admin routes
 * type against this name. The shape is provider-agnostic — an account created
 * on either reseller comes back in exactly the same envelope.
 */
export type WhmCreateAcctResult = HostingAccountResult;

type WhmRawResponse = {
  metadata?: { result?: 0 | 1; reason?: string };
  data?: { ip?: string; [k: string]: unknown };
  result?: Array<{ status: 0 | 1; statusmsg?: string }>;
};

function authHeader(server: WhmServer): string {
  return `whm ${server.apiUser}:${server.apiToken}`;
}

/**
 * A WHM host that drops packets (wrong port, firewall, IP not allowlisted)
 * leaves `fetch` hanging until the serverless platform kills the whole function
 * — the caller gets a 502 with no diagnosis. These caps make the failure come
 * back as a normal, readable error instead.
 *
 * The probe is read-only, so it can give up fast, inside the function's own
 * budget. Creating an account cannot: WHM takes its time and aborting a request
 * that already reached the server would leave an orphan account behind while we
 * report a failure. Keep that one generous — the platform's own limit is the
 * real ceiling.
 */
const WHM_PROBE_TIMEOUT_MS = 8_000;
const WHM_CREATE_TIMEOUT_MS = 45_000;

export async function createCpanelAccount(
  order: Order,
  server: WhmServer = primaryServer(),
): Promise<WhmCreateAcctResult> {
  const domain = order.payload.hosting.domain;
  const username = deriveUsername(domain);
  const password = generatePassword();
  const pkg = packageForPlan(order.payload.planId, server);
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

  const url = `${server.apiUrl}/json-api/createacct?${params.toString()}`;

  console.log("[whm] createacct", {
    order: order.id,
    server: server.key,
    domain,
    package: pkg,
  });

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authHeader(server),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(WHM_CREATE_TIMEOUT_MS),
    });
  } catch (err) {
    const e = err as Error;
    const detail =
      e.name === "TimeoutError" ? `no respondió en ${WHM_CREATE_TIMEOUT_MS / 1000}s` : e.message;
    return {
      ok: false,
      error: `WHM unreachable (${server.key}): ${detail}`,
      code: "unknown",
    };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const error = `WHM HTTP ${res.status} (${server.key}): ${body.slice(0, 200)}`;
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

/** A package as WHM returns it: every limit comes back as a string. */
export type WhmPackage = Record<string, string> & { name: string };

type ListPkgsResponse = {
  metadata?: { result?: 0 | 1; reason?: string };
  data?: { pkg?: WhmPackage[] };
};

/** Package names are stored prefixed with the owning reseller ("user_Starter"). */
function barePackageName(name: string): string {
  return name.replace(/^[^_]*_/, "");
}

export async function listPackages(
  server: WhmServer,
): Promise<{ ok: true; packages: WhmPackage[] } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${server.apiUrl}/json-api/listpkgs?api.version=1`, {
      method: "GET",
      headers: { Authorization: authHeader(server) },
      cache: "no-store",
      signal: AbortSignal.timeout(WHM_PROBE_TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `WHM HTTP ${res.status}: ${body.slice(0, 300)}` };
    }
    const json = (await res.json().catch(() => null)) as ListPkgsResponse | null;
    if (json?.metadata?.result !== 1) {
      return {
        ok: false,
        error: json?.metadata?.reason ?? "listpkgs devolvió un cuerpo inesperado",
      };
    }
    return { ok: true, packages: (json.data?.pkg ?? []).filter((p) => Boolean(p?.name)) };
  } catch (err) {
    const e = err as Error;
    return {
      ok: false,
      error:
        e.name === "TimeoutError"
          ? `El servidor no respondió en ${WHM_PROBE_TIMEOUT_MS / 1000}s — revisa el host y el puerto (:2087) y que la IP de Netlify esté permitida en el firewall.`
          : `WHM unreachable: ${e.message}`,
    };
  }
}

type PkgInfoResponse = {
  metadata?: { result?: 0 | 1; reason?: string };
  data?: { pkg?: Record<string, string> };
};

/**
 * Reads one package by name.
 *
 * This is the authoritative "does this package exist here" check: `listpkgs`
 * only returns the packages the authenticated reseller OWNS, so a package
 * created for it by root — as `genioram_News Page` and `genioram_Mega News Page`
 * turned out to be — is missing from that list while being perfectly usable in
 * `createacct`.
 */
export async function getPackage(
  server: WhmServer,
  name: string,
): Promise<WhmPackage | null> {
  const params = new URLSearchParams({ "api.version": "1", pkg: name });
  try {
    const res = await fetch(`${server.apiUrl}/json-api/getpkginfo?${params.toString()}`, {
      method: "GET",
      headers: { Authorization: authHeader(server) },
      cache: "no-store",
      signal: AbortSignal.timeout(WHM_PROBE_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as PkgInfoResponse | null;
    if (json?.metadata?.result !== 1 || !json.data?.pkg) return null;
    return { ...json.data.pkg, name };
  } catch {
    return null;
  }
}

/**
 * Limits we copy when replicating a package on another reseller. Everything
 * else WHM returns is either not an `addpkg` parameter (PACKAGE_TYPE) or is
 * server-specific and would fail there — `_PACKAGE_EXTENSIONS` names plugins
 * like magicspam that the other provider may not have installed, and `IP`
 * refers to that server's own addresses.
 */
const PACKAGE_FIELDS: Array<[whmField: string, addpkgParam: string]> = [
  ["QUOTA", "quota"],
  ["BWLIMIT", "bwlimit"],
  ["MAXFTP", "maxftp"],
  ["MAXSQL", "maxsql"],
  ["MAXPOP", "maxpop"],
  ["MAXLST", "maxlst"],
  ["MAXSUB", "maxsub"],
  ["MAXPARK", "maxpark"],
  ["MAXADDON", "maxaddon"],
  ["CGI", "cgi"],
  ["HASSHELL", "hasshell"],
  ["CPMOD", "cpmod"],
  ["FEATURELIST", "featurelist"],
  ["MAX_EMAIL_PER_HOUR", "max_email_per_hour"],
  ["MAX_EMAILACCT_QUOTA", "max_emailacct_quota"],
  ["MAX_DEFER_FAIL_PERCENTAGE", "max_defer_fail_percentage"],
  ["MAXPASSENGERAPPS", "maxpassengerapps"],
  ["DIGESTAUTH", "digestauth"],
  ["LANG", "language"],
];

/**
 * Some limits mean "unlimited" as a 0 on the primary, but a newer WHM rejects
 * the 0 outright ("Invalid value 0 for the max_email_per_hour setting") and the
 * whole package creation fails with it.
 */
const ZERO_MEANS_UNLIMITED = new Set(["max_email_per_hour", "max_defer_fail_percentage"]);

/**
 * Packages that exist on neither reseller, so there is nothing to copy: the
 * limits come from what the plan promises the customer in src/lib/plans.ts.
 * "3 dominios" is the main domain plus 2 addons — the convention the existing
 * packages already follow (Ads_Basic: 3 dominios → MAXADDON 2).
 *
 * Keyed by plan id; `name` is the package name WITHOUT the reseller prefix,
 * which WHM adds on its own.
 */
const PACKAGE_SPECS: Record<string, WhmPackage> = {
  news: {
    name: "News Page",
    QUOTA: "20480", // 20 GB
    BWLIMIT: "122880", // 120 GB
    MAXPOP: "10",
    MAX_EMAILACCT_QUOTA: "500",
    MAXSQL: "10",
    MAXADDON: "2",
    MAXSUB: "5",
    MAXPARK: "0",
    MAXFTP: "3",
    MAXLST: "0",
    CGI: "y",
    HASSHELL: "n",
    CPMOD: "jupiter",
    FEATURELIST: "default",
    LANG: "es",
    DIGESTAUTH: "n",
    MAX_EMAIL_PER_HOUR: "unlimited",
    MAX_DEFER_FAIL_PERCENTAGE: "unlimited",
  },
  mega: {
    name: "Mega News Page",
    QUOTA: "40960", // 40 GB
    BWLIMIT: "204800", // 200 GB
    MAXPOP: "10",
    MAX_EMAILACCT_QUOTA: "1024",
    MAXSQL: "10",
    MAXADDON: "2",
    MAXSUB: "5",
    MAXPARK: "0",
    MAXFTP: "3",
    MAXLST: "0",
    CGI: "y",
    HASSHELL: "n",
    CPMOD: "jupiter",
    FEATURELIST: "default",
    LANG: "es",
    DIGESTAUTH: "n",
    MAX_EMAIL_PER_HOUR: "unlimited",
    MAX_DEFER_FAIL_PERCENTAGE: "unlimited",
  },
};

/**
 * The limits src/lib/plans.ts actually promises the customer. Everything else
 * in a package (FTP accounts, parked domains, feature list) is an operational
 * choice the page says nothing about, so aligning a package "to what we
 * promise" must not touch those.
 */
const PROMISED_FIELDS = [
  "QUOTA",
  "BWLIMIT",
  "MAXPOP",
  "MAX_EMAILACCT_QUOTA",
  "MAXSQL",
  "MAXADDON",
  "MAXSUB",
] as const;

/**
 * The existing package with the plan's promised limits laid over it. Used to
 * bring a package back in line with the page — in either direction: the mega
 * package was handing out 50 GB against 40 GB promised, and 8 databases against
 * 10 promised.
 */
function promisedPackage(plan: string, current: WhmPackage): WhmPackage | null {
  const spec = PACKAGE_SPECS[plan];
  if (!spec) return null;
  const merged: WhmPackage = { ...current };
  for (const field of PROMISED_FIELDS) {
    if (spec[field] !== undefined) merged[field] = spec[field];
  }
  return merged;
}

/** The subset that every WHM accepts, for the retry when a field is rejected. */
const CORE_PACKAGE_FIELDS = new Set([
  "quota",
  "bwlimit",
  "maxftp",
  "maxsql",
  "maxpop",
  "maxsub",
  "maxpark",
  "maxaddon",
  "cgi",
  "hasshell",
  "cpmod",
  "featurelist",
]);

async function writePackage(
  server: WhmServer,
  name: string,
  source: WhmPackage,
  onlyCore: boolean,
  mode: "add" | "edit" = "add",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const params = new URLSearchParams({ "api.version": "1", name });
  for (const [field, param] of PACKAGE_FIELDS) {
    if (onlyCore && !CORE_PACKAGE_FIELDS.has(param)) continue;
    const value = source[field];
    if (value === undefined || value === "") continue;
    params.set(param, value === "0" && ZERO_MEANS_UNLIMITED.has(param) ? "unlimited" : value);
  }

  const endpoint = mode === "edit" ? "editpkg" : "addpkg";

  try {
    const res = await fetch(`${server.apiUrl}/json-api/${endpoint}?${params.toString()}`, {
      method: "GET",
      headers: { Authorization: authHeader(server) },
      cache: "no-store",
      signal: AbortSignal.timeout(WHM_PROBE_TIMEOUT_MS),
    });
    const json = (await res.json().catch(() => null)) as {
      metadata?: { result?: 0 | 1; reason?: string };
    } | null;
    if (!res.ok) return { ok: false, error: `WHM HTTP ${res.status}` };
    if (json?.metadata?.result !== 1) {
      return { ok: false, error: json?.metadata?.reason ?? `${endpoint} falló sin motivo` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type PackageSyncAction = {
  server: "primary" | "secondary";
  plan: string;
  /** Full package name expected on that reseller. */
  target: string;
  status:
    | "exists"
    | "would-create"
    | "created"
    | "would-align"
    | "aligned"
    | "no-source"
    | "error";
  /** Where the limits came from: another package, or the plan definition. */
  source?: string;
  detail?: string;
};

/**
 * Makes sure every plan has its package on both resellers.
 *
 * A package missing on the SECOND reseller is copied from the primary, so a
 * fallback account gets the same limits the customer paid for (a brand-new
 * reseller starts empty and `createacct` fails without packages). A package
 * missing on BOTH — nothing to copy from — is built from PACKAGE_SPECS, i.e.
 * from what the plan promises in src/lib/plans.ts.
 *
 * Dry run by default: pass `apply` to actually create anything. Idempotent —
 * a package that already exists is left untouched, never overwritten.
 */
export async function syncPackages(opts: {
  apply: boolean;
  targets?: Array<"primary" | "secondary">;
  /**
   * Rewrite packages that already exist instead of leaving them as they are.
   * For repairing one that was created from an outdated source.
   */
  overwrite?: boolean;
  /**
   * What an overwrite aligns to: "primary" (default) copies the primary
   * reseller's limits onto the second one; "plan" lays the limits promised in
   * src/lib/plans.ts over whatever each server has, on both of them.
   */
  from?: "primary" | "plan";
  /** Restrict the run to these plan ids. */
  plans?: string[];
}): Promise<{
  ok: boolean;
  apply: boolean;
  error?: string;
  actions: PackageSyncAction[];
}> {
  const targets = opts.targets ?? ["primary", "secondary"];
  const secondary = secondaryServer();
  if (targets.includes("secondary") && !secondary) {
    return {
      ok: false,
      apply: opts.apply,
      error: "El reseller secundario no está configurado (WHM2_API_URL/USER/TOKEN)",
      actions: [],
    };
  }

  const primary = primaryServer();
  const alignTo = opts.from ?? "primary";
  const plans = Object.keys(planToPackage).filter(
    (plan) => !opts.plans?.length || opts.plans.includes(plan),
  );

  // Read each package by name instead of listing: listpkgs hides the ones the
  // reseller does not own, which is how "genioram_News Page" looked missing
  // while createacct would have accepted it.
  const reference = new Map<string, WhmPackage | null>(
    await Promise.all(
      plans.map(
        async (plan) =>
          [plan, await getPackage(primary, packageForPlan(plan, primary))] as const,
      ),
    ),
  );
  const actions: PackageSyncAction[] = [];

  for (const key of targets) {
    const server = key === "primary" ? primary : secondary;
    if (!server) continue;

    for (const plan of plans) {
      const target = packageForPlan(plan, server);
      const bare = barePackageName(target);

      // The primary is the reference for the second reseller; the plan
      // definition covers whatever neither of them has.
      const copied = key === "secondary" ? reference.get(plan) : undefined;
      const spec = PACKAGE_SPECS[plan];
      const source = copied ?? spec;
      const sourceLabel = copied ? copied.name : spec ? "definición del plan" : undefined;

      const current = key === "primary" ? reference.get(plan) : await getPackage(server, target);

      if (current) {
        // Aligning to the plan works on both servers: the reference is the page,
        // not the other reseller. Aligning to the primary only makes sense for
        // the second one — the primary has nothing above it to copy from.
        const aligned =
          alignTo === "plan" ? promisedPackage(plan, current) : key === "secondary" ? copied : null;
        const alignedLabel =
          alignTo === "plan" ? "límites prometidos en el plan" : aligned?.name;

        if (!opts.overwrite || !aligned || !alignedLabel) {
          actions.push({ server: key, plan, target, status: "exists" });
          continue;
        }
        if (!opts.apply) {
          actions.push({ server: key, plan, target, status: "would-align", source: alignedLabel });
          continue;
        }
        const edited = await writePackage(server, target, aligned, false, "edit");
        actions.push(
          edited.ok
            ? { server: key, plan, target, status: "aligned", source: alignedLabel }
            : {
                server: key,
                plan,
                target,
                status: "error",
                source: alignedLabel,
                detail: edited.error,
              },
        );
        continue;
      }

      if (!source || !sourceLabel) {
        actions.push({
          server: key,
          plan,
          target,
          status: "no-source",
          detail: `No hay de dónde copiar "${bare}" ni una definición en PACKAGE_SPECS`,
        });
        continue;
      }
      if (!opts.apply) {
        actions.push({ server: key, plan, target, status: "would-create", source: sourceLabel });
        continue;
      }

      let created = await writePackage(server, bare, source, false);
      let detail: string | undefined;
      if (!created.ok) {
        // A field the other WHM does not know about rejects the whole call —
        // retry with the limits every version accepts.
        detail = `Reintento con campos básicos tras: ${created.error}`;
        created = await writePackage(server, bare, source, true);
      }

      actions.push(
        created.ok
          ? { server: key, plan, target, status: "created", source: sourceLabel, detail }
          : { server: key, plan, target, status: "error", source: sourceLabel, detail: created.error },
      );
    }
  }

  return { ok: actions.every((a) => a.status !== "error"), apply: opts.apply, actions };
}

export type WhmProbe = {
  configured: boolean;
  server: "primary" | "secondary";
  apiUrl: string | null;
  auth: { ok: boolean; detail: string };
  /** Package names this token can actually see on that reseller. */
  packages: string[];
  /** What each plan would be created with, and whether that package exists. */
  plans: Array<{ plan: string; package: string; exists: boolean }>;
};

/**
 * Connectivity/permission probe against a reseller. It creates nothing: it
 * lists the packages the API token can see and checks that the package we would
 * send for every plan is one of them — the mismatch that would otherwise only
 * show up with a paying customer waiting.
 */
export async function whmProbe(which: "primary" | "secondary"): Promise<WhmProbe> {
  let server: WhmServer | undefined;
  try {
    server = which === "secondary" ? secondaryServer() : primaryServer();
  } catch {
    // primaryServer() throws when its env vars are missing.
    server = undefined;
  }

  if (!server) {
    const detail =
      which === "secondary"
        ? "WHM2_API_URL, WHM2_API_USER y WHM2_API_TOKEN no están configurados"
        : "WHM_API_URL, WHM_API_USER y WHM_API_TOKEN no están configurados";
    return {
      configured: false,
      server: which,
      apiUrl: null,
      auth: { ok: false, detail },
      packages: [],
      plans: [],
    };
  }

  const listed = await listPackages(server);
  const packages = listed.ok ? listed.packages.map((p) => p.name) : [];
  const auth = listed.ok
    ? { ok: true, detail: `${packages.length} paquetes propios del reseller` }
    : { ok: false, detail: listed.error };

  // `exists` comes from reading each package by name, not from the list above:
  // listpkgs only returns what the reseller owns, so a package created for it
  // by root is absent there while createacct accepts it perfectly.
  const plans = auth.ok
    ? await Promise.all(
        Object.keys(planToPackage).map(async (plan) => {
          const pkg = packageForPlan(plan, server);
          return { plan, package: pkg, exists: (await getPackage(server, pkg)) !== null };
        }),
      )
    : Object.keys(planToPackage).map((plan) => ({
        plan,
        package: packageForPlan(plan, server),
        exists: false,
      }));

  return { configured: true, server: which, apiUrl: server.apiUrl, auth, packages, plans };
}

/**
 * What to do when the primary reseller refuses the account.
 *
 *   "capacity" — create it in the second reseller automatically, but only when
 *                the primary ran out of accounts or disk. This is the default
 *                once WHM2_* credentials exist.
 *   "any"      — automatic on any error except a conflict (a domain or login
 *                that already exists would clash there too, and we would risk
 *                creating the account twice).
 *   "manual"   — do NOT call the second reseller's API. Email the team a work
 *                order to create the account by hand and finish it with
 *                /api/admin/complete-order. Default while WHM2_* is unset.
 *   "off"      — never fall back; behaves as if there were a single reseller.
 *
 * Check the credentials with GET /api/admin/whm-check?server=secondary before
 * relying on the automatic modes.
 */
function fallbackMode(): "manual" | "capacity" | "any" | "off" {
  const v = process.env.PROVISION_FALLBACK_MODE?.trim().toLowerCase();
  if (v === "capacity" || v === "any" || v === "off" || v === "manual") return v;
  return isSecondaryConfigured() ? "capacity" : "manual";
}

function shouldAutoFallback(result: Extract<HostingAccountResult, { ok: false }>): boolean {
  const mode = fallbackMode();
  if (mode === "off" || mode === "manual") return false;
  if (mode === "any") return result.code !== "conflict";
  return result.code === "capacity";
}

/**
 * How the credentials email should describe an account on this reseller. The
 * primary needs no overrides (HOSTING_NS1/NS2 and https://<domain>:2083 already
 * describe it); the second one lives on another provider, so its nameservers
 * and panel hostname have to travel with the email.
 */
function presentationFor(server: WhmServer): CredentialsPresentation | undefined {
  if (server.key === "primary") return undefined;
  if (!server.ns1 || !server.ns2) {
    console.warn(
      "[whm2] WHM2_NS1/WHM2_NS2 not set — the credentials email will send the primary reseller's nameservers",
    );
  }
  return {
    panel: "cpanel",
    ns1: server.ns1,
    ns2: server.ns2,
    panelUrl: server.panelUrl,
    showNameservers: true,
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

  const primary = primaryServer();
  let server = primary;
  let result = await createCpanelAccount(order, primary);
  // Set when the alert should be a "create it by hand in the second reseller"
  // work order rather than a generic provisioning failure.
  let manualFallback = false;

  if (!result.ok) {
    console.error("[whm] createacct failed", {
      order: order.id,
      server: primary.key,
      error: result.error,
      code: result.code ?? "unknown",
    });

    const primaryError = result.error;
    const secondary = secondaryServer();
    const isFull = result.code === "capacity";

    if (fallbackMode() === "manual") {
      manualFallback = isFull;
      if (isFull) {
        console.warn(
          "[provision] primary reseller full — handing over to a manual account in the second reseller",
          order.id,
        );
      }
    } else if (!shouldAutoFallback(result)) {
      console.log("[provision] not falling back", {
        order: order.id,
        mode: fallbackMode(),
        code: result.code ?? "unknown",
      });
    } else if (!secondary) {
      console.warn(
        "[provision] primary reseller is full but the second one is not configured (WHM2_*)",
        order.id,
      );
      manualFallback = isFull;
    } else {
      console.warn("[provision] primary reseller unavailable, falling back to the second one", {
        order: order.id,
        code: result.code ?? "unknown",
      });

      const fallback = await createCpanelAccount(order, secondary);
      if (fallback.ok) {
        result = fallback;
        server = secondary;
      } else {
        console.error("[whm2] fallback failed", { order: order.id, error: fallback.error });
        // Both resellers refused it — surface the two reasons in the ops alert.
        result = {
          ok: false,
          error: `${primary.label}: ${primaryError} · ${secondary.label}: ${fallback.error}`,
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
        manualFallback ? { manualFallback: true } : undefined,
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

  await completeProvisioning(order, result, presentationFor(server), {
    provider: server.key === "secondary" ? "whm2" : "whm",
  });

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
      provider: flow?.provider ?? "whm",
    });
  } catch (err) {
    console.error("[whm] failed to persist provisioning info", err);
  }

  console.log("[provision] hosting account created", {
    order: order.id,
    username: result.username,
    domain: result.domain,
    panel,
    provider: flow?.provider ?? "whm",
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
