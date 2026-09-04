import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { syncSecondaryPackages } from "@/lib/whm";

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Replicates the primary reseller's packages on the second one.
 *
 * A brand-new reseller has no packages of its own, and `createacct` needs one:
 * without this, the automatic fallback fails for every plan. Copying from the
 * primary keeps the limits the customer actually paid for.
 *
 * Dry run unless you pass `{"apply": true}` — the answer lists what it would
 * create. Idempotent: a package that already exists there is left alone, never
 * overwritten, so it is safe to re-run after adjusting anything by hand.
 *
 * Usage: POST /api/admin/whm-packages with `Authorization: Bearer <RESCUE_SECRET>`
 *        body {"apply": true} to write.
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
  try {
    const body = (await req.json()) as { apply?: unknown };
    apply = body?.apply === true;
  } catch {
    // No body means dry run.
  }

  const result = await syncSecondaryPackages({ apply });

  console.log("[admin:whm-packages] sync", {
    apply,
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
            warning: `Sin paquete de origen en el primario para: ${missingSource
              .map((a) => a.plan)
              .join(", ")}. Hay que crearlos a mano en los dos servidores o corregir el mapeo de planes.`,
          }
        : {}),
    },
    { status: result.error ? 502 : 200 },
  );
}
