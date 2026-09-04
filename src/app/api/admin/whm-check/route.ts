import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { whmProbe } from "@/lib/whm";

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Diagnoses a WHM reseller connection WITHOUT creating anything.
 *
 * Answers the two questions we need before letting the fallback run on its own:
 *   auth.ok — does the API token authenticate (json-api/listpkgs)?
 *   plans   — for every plan, the package we would send and whether it actually
 *             exists on that reseller. WHM prefixes packages with the owning
 *             reseller username, so the second server needs WHM2_PACKAGE_PREFIX
 *             or WHM2_PACKAGE_MAP; `packages` lists the real names to copy.
 *
 * Auth-gated rather than dev-only on purpose: WHM tokens are usually restricted
 * to allowlisted IPs, so the answer is only meaningful from the deployed server.
 *
 * Usage: GET /api/admin/whm-check?server=secondary (default) | primary
 *        with `Authorization: Bearer <RESCUE_SECRET>`.
 */
export async function GET(req: Request) {
  const expected = process.env.RESCUE_SECRET;
  if (!expected) {
    console.error("[admin:whm-check] RESCUE_SECRET not configured");
    return new NextResponse("Not configured", { status: 503 });
  }

  const auth = req.headers.get("authorization") ?? "";
  const presented = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (!presented || !constantTimeEquals(presented, expected)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const which =
    new URL(req.url).searchParams.get("server") === "primary" ? "primary" : "secondary";

  const probe = await whmProbe(which);
  console.log("[admin:whm-check] probe", {
    server: probe.server,
    configured: probe.configured,
    auth: probe.auth.ok,
    packages: probe.packages.length,
  });

  const missing = probe.plans.filter((p) => !p.exists).map((p) => p.plan);

  return NextResponse.json({
    ...probe,
    recommendation: !probe.configured
      ? which === "secondary"
        ? "Configura WHM2_API_URL (con :2087), WHM2_API_USER y WHM2_API_TOKEN."
        : "Configura WHM_API_URL (con :2087), WHM_API_USER y WHM_API_TOKEN."
      : !probe.auth.ok
        ? "El token no autenticó. Revísalo en WHM → Manage API Tokens y confirma que la IP del servidor esté permitida."
        : missing.length
          ? `Estos planes apuntan a paquetes que no existen en el reseller: ${missing.join(", ")}. Ajusta WHM2_PACKAGE_PREFIX o WHM2_PACKAGE_MAP con los nombres de "packages".`
          : "Listo: el token autentica y todos los planes tienen paquete. Puedes usar PROVISION_FALLBACK_MODE=capacity.",
  });
}
