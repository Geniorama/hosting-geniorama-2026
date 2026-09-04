import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { syncPackages } from "@/lib/whm";

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Makes sure every plan has its WHM package on both resellers.
 *
 * Missing on the second reseller → copied from the primary, so a fallback
 * account gets the limits the customer paid for. Missing on both → created from
 * the plan definition in src/lib/plans.ts. Without a package, `createacct`
 * fails, which is what happens today for the "news" and "mega" plans.
 *
 * Dry run unless you pass `{"apply": true}` — the answer lists what it would
 * create. Idempotent: a package that already exists is left alone, never
 * overwritten, so it is safe to re-run after adjusting anything by hand.
 *
 * Usage: POST /api/admin/whm-packages with `Authorization: Bearer <RESCUE_SECRET>`
 *        body {"apply": true} to write,
 *        {"targets": ["secondary"]} to touch only one reseller.
 */
export async function POST(req: Request) {
  const expected = process.env.RESCUE_SECRET;
  if (!expected) {
    console.error("[admin:whm-packages] RESCUE_SECRET not configured");
    return new NextResponse("Not configured", { status: 503 });
  }

  const auth = req.headers.get("authorization") ?? "";
  const presented = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (!presented || !constantTimeEquals(presented, expected)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let apply = false;
  let targets: Array<"primary" | "secondary"> | undefined;
  try {
    const body = (await req.json()) as { apply?: unknown; targets?: unknown };
    apply = body?.apply === true;
    if (Array.isArray(body?.targets)) {
      const picked = body.targets.filter(
        (t): t is "primary" | "secondary" => t === "primary" || t === "secondary",
      );
      if (picked.length) targets = picked;
    }
  } catch {
    // No body means a dry run over both resellers.
  }

  const result = await syncPackages({ apply, targets });

  console.log("[admin:whm-packages] sync", {
    apply,
    targets: targets ?? ["primary", "secondary"],
    ok: result.ok,
    error: result.error,
    created: result.actions.filter((a) => a.status === "created").length,
    exists: result.actions.filter((a) => a.status === "exists").length,
    failed: result.actions.filter((a) => a.status === "error").length,
  });

  const missingSource = result.actions.filter((a) => a.status === "no-source");

  return NextResponse.json(
    {
      ...result,
      hint: result.error
        ? "No se pudo leer alguno de los dos resellers — revisa el detalle en `error`."
        : apply
          ? "Corre GET /api/admin/whm-check?server=secondary para confirmar que los planes quedaron en exists:true."
          : "Simulacro: nada se creó. Repite con {\"apply\": true} para aplicarlo.",
      ...(missingSource.length
        ? {
            warning: `Sin origen ni definición para: ${missingSource
              .map((a) => `${a.plan} (${a.server})`)
              .join(", ")}. Agrega su spec en PACKAGE_SPECS o créalos a mano.`,
          }
        : {}),
    },
    { status: result.error ? 502 : 200 },
  );
}
