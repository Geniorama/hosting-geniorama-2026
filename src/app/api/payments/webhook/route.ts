import { NextResponse } from "next/server";
import {
  PaymentsWayStatus,
  type PaymentsWayWebhookPayload,
  verifyWebhookChecksum,
} from "@/lib/paymentsway";
import { orderStore, type OrderStatus } from "@/lib/order-store";

const statusMap: Record<number, OrderStatus> = {
  [PaymentsWayStatus.SUCCESS]: "success",
  [PaymentsWayStatus.PENDING]: "pending",
  [PaymentsWayStatus.PENDING_CASH]: "pending",
  [PaymentsWayStatus.FAILED]: "failed",
  [PaymentsWayStatus.CANCELLED]: "cancelled",
  [PaymentsWayStatus.REFUNDED]: "refunded",
  [PaymentsWayStatus.CREATED]: "created",
};

export async function POST(req: Request) {
  let payload: PaymentsWayWebhookPayload;
  try {
    payload = (await req.json()) as PaymentsWayWebhookPayload;
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const apiKey = process.env.PAYMENTSWAY_API_KEY;
  if (apiKey && payload.checksum && !verifyWebhookChecksum(payload, apiKey)) {
    console.warn("[paymentsway:webhook] checksum mismatch", {
      order: payload.externalorder,
    });
    return new NextResponse("Invalid checksum", { status: 401 });
  }

  const statusId = payload.idstatus?.id;
  const newStatus = statusMap[statusId] ?? "pending";

  let updated;
  try {
    updated = await orderStore.updateStatus(
      payload.externalorder,
      newStatus,
      String(payload.id),
    );
  } catch (err) {
    console.error("[paymentsway:webhook] db error", err);
    return new NextResponse("DB error", { status: 500 });
  }

  if (!updated) {
    console.warn("[paymentsway:webhook] unknown order", payload.externalorder);
  } else {
    console.log("[paymentsway:webhook]", {
      order: payload.externalorder,
      status: newStatus,
      paymentRef: String(payload.id),
    });
  }

  // PaymentsWay expects 200 only for successful (status 34), 201 for everything else
  const isSuccess = statusId === PaymentsWayStatus.SUCCESS;
  return new NextResponse(JSON.stringify({ ok: true }), {
    status: isSuccess ? 200 : 201,
    headers: { "content-type": "application/json" },
  });
}
