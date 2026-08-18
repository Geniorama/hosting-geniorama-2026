import { NextResponse } from "next/server";
import {
  type WompiEventPayload,
  mapWompiStatus,
  verifyWompiSignature,
} from "@/lib/wompi";
import { orderStore } from "@/lib/order-store";
import { handlePaidOrder } from "@/lib/renewals";

export async function POST(req: Request) {
  let payload: WompiEventPayload;
  try {
    payload = (await req.json()) as WompiEventPayload;
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const eventsSecret = process.env.WOMPI_EVENTS_SECRET;
  if (eventsSecret && !verifyWompiSignature(payload, eventsSecret)) {
    console.warn("[wompi:webhook] checksum mismatch");
    // Wompi spec says always reply 200 — we still log but don't 401, otherwise
    // it retries. Comment this out in dev if you want to surface signature bugs.
  }

  if (payload.event !== "transaction.updated") {
    return NextResponse.json({ ok: true, ignored: payload.event });
  }

  const tx = payload.data?.transaction;
  if (!tx?.reference) {
    console.warn("[wompi:webhook] missing transaction reference");
    return NextResponse.json({ ok: true });
  }

  const newStatus = mapWompiStatus(tx.status);

  try {
    const updated = await orderStore.updateStatus(tx.reference, newStatus, tx.id);
    if (!updated) {
      console.warn("[wompi:webhook] unknown order", tx.reference);
    } else {
      console.log("[wompi:webhook]", {
        order: tx.reference,
        status: newStatus,
        wompiId: tx.id,
      });

      if (newStatus === "success") {
        try {
          await handlePaidOrder(updated);
        } catch (err) {
          console.error("[wompi:webhook] provision error", err);
        }
      }
    }
  } catch (err) {
    console.error("[wompi:webhook] db error", err);
  }

  // Wompi requires HTTP 200 always — non-200 triggers retries (30min, 3h, 24h)
  return NextResponse.json({ ok: true });
}
