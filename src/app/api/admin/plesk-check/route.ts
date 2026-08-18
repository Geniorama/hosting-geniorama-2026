import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { pleskProbe } from "@/lib/plesk";

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Diagnoses the Plesk reseller connection WITHOUT creating anything.
 *
 * Answers the two questions we need before turning the fallback on:
 *   auth.ok — do the credentials authenticate (GET /api/v2/server)?
 *   cli.ok  — is /api/v2/cli reachable for them, i.e. can we use
 *             PLESK_PROVISION_MODE=cli? If not, switch to "rest".
 *
 * Auth-gated rather than dev-only on purpose: Plesk providers commonly allow API
 * access from allowlisted IPs, so the answer is only meaningful when the probe
 * runs from the deployed server.
 *
 * Usage: GET /api/admin/plesk-check with `Authorization: Bearer <RESCUE_SECRET>`.
 */
export async function GET(req: Request) {
  const expected = process.env.RESCUE_SECRET;
  if (!expected) {
    console.error("[admin:plesk-check] RESCUE_SECRET not configured");
    return new NextResponse("Not configured", { status: 503 });
  }

  const auth = req.headers.get("authorization") ?? "";
  const presented = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (!presented || !constantTimeEquals(presented, expected)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const probe = await pleskProbe();
  console.log("[admin:plesk-check] probe", {
    configured: probe.configured,
    mode: probe.mode,
    auth: probe.auth.ok,
    cli: probe.cli.ok,
  });

  return NextResponse.json({
    ...probe,
    recommendation: !probe.configured
      ? "Set PLESK_API_URL and PLESK_API_KEY (or PLESK_API_USER/PLESK_API_PASSWORD)."
      : !probe.auth.ok
        ? "Credentials or IP allowlist rejected. Ask the provider to enable API access for this server's IP. If the certificate is self-signed, set PLESK_ALLOW_SELF_SIGNED=true."
        : probe.cli.ok
          ? "Use PLESK_PROVISION_MODE=cli."
          : "CLI is not available for these credentials — use PLESK_PROVISION_MODE=rest.",
  });
}
