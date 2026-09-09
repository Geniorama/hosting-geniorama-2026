import { NextResponse } from "next/server";
import { plans } from "@/lib/plans";
import { trackInitiateCheckout, trackingFromHeaders } from "@/lib/meta-events";
import { clientKey, rateLimited } from "@/lib/rate-limit";

/**
 * Espejo en el servidor del InitiateCheckout que dispara el navegador.
 *
 * Existe porque ese evento nace en el cliente (ver el comentario en
 * trackInitiateCheckout: dispararlo en el render del servidor lo contaría en
 * cada prefetch), pero mandarlo también por la API de conversiones es lo que lo
 * salva de los bloqueadores. Los dos van con el mismo eventId y Meta los une.
 *
 * A propósito NO es un endpoint genérico de eventos: solo acepta
 * InitiateCheckout y el precio lo saca del catálogo, nunca del cuerpo. Lo
 * peor que puede hacer alguien que lo llame a mano es inflar ese evento, y para
 * eso está el rate limit.
 */

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 20;

const MAX_EVENT_ID = 64;

export async function POST(req: Request) {
  if (rateLimited("meta-track", clientKey(req), RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const eventId = typeof body.eventId === "string" ? body.eventId.trim().slice(0, MAX_EVENT_ID) : "";
  const planId = typeof body.planId === "string" ? body.planId.trim() : "";
  const billing = body.billing === "monthly" ? "monthly" : "annual";

  if (!eventId || !planId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Un plan inventado no genera evento: así el endpoint no sirve para meter
  // basura en Events Manager.
  const known = [...plans.web, ...plans.ads].some((p) => p.id === planId);
  if (!known) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await trackInitiateCheckout({
    eventId,
    planId,
    billing,
    tracking: trackingFromHeaders(req.headers, req.headers.get("referer") ?? undefined),
  });

  return NextResponse.json({ ok: true });
}
