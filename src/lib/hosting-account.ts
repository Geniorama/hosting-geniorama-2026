import crypto from "node:crypto";

/** Control panel an account lives on. */
export type PanelType = "cpanel" | "plesk";

/**
 * Why a provider refused to create the account. This drives the fallback
 * decision: only "capacity" means "this reseller is full, try the next one".
 * A "conflict" (domain or login already taken) or a "config" error would fail
 * the same way on every provider, so retrying elsewhere just doubles the noise.
 */
export type ProvisionErrorCode = "capacity" | "conflict" | "config" | "unknown";

/**
 * Result of asking a provider to create a hosting account. Shared by the WHM
 * (cPanel) and Plesk adapters so the downstream steps — credentials email,
 * tickets sync, Trello card — don't care where the account lives.
 */
export type HostingAccountResult =
  | {
      ok: true;
      username: string;
      domain: string;
      password: string;
      package: string;
      ip?: string;
      raw: unknown;
    }
  | { ok: false; error: string; code?: ProvisionErrorCode; raw?: unknown };

// Substrings that mean "the reseller ran out of room". WHM and Plesk word these
// differently and providers customise them, so PROVISION_CAPACITY_PATTERNS
// (comma-separated) appends to this list without a code change.
const CAPACITY_PATTERNS = [
  "maximum number of accounts",
  "maximum number of hosting accounts",
  "reached your limit",
  "account limit",
  "exceeded the maximum",
  "not enough disk space",
  "insufficient disk space",
  "out of disk space",
  "quota exceeded",
  "no available ip",
  "limit of subscriptions",
  "subscription limit",
];

const CONFLICT_PATTERNS = [
  "already exists",
  "is already",
  "already in use",
  "already taken",
  "duplicate",
];

function extraCapacityPatterns(): string[] {
  const raw = process.env.PROVISION_CAPACITY_PATTERNS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function classifyProvisionError(reason: string): ProvisionErrorCode {
  const r = reason.toLowerCase();
  if ([...CAPACITY_PATTERNS, ...extraCapacityPatterns()].some((p) => r.includes(p))) {
    return "capacity";
  }
  if (CONFLICT_PATTERNS.some((p) => r.includes(p))) return "conflict";
  return "unknown";
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
