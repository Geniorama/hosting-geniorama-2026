import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { orderStore } from "@/lib/order-store";
import { provisionIfNeeded } from "@/lib/whm";

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export async function POST(req: Request) {
  const expected = process.env.RESCUE_SECRET;
  if (!expected) {
    console.error("[admin:rescue] RESCUE_SECRET not configured");
    return new NextResponse("Not configured", { status: 503 });
  }

  const auth = req.headers.get("authorization") ?? "";
  const presented = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (!presented || !constantTimeEquals(presented, expected)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let body: { orderId?: unknown };
  try {
    body = (await req.json()) as { orderId?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  if (!orderId) {
    return NextResponse.json(
      { ok: false, error: "Missing orderId" },
      { status: 400 },
    );
  }

  const order = await orderStore.get(orderId);
  if (!order) {
    return NextResponse.json(
      { ok: false, error: `Order ${orderId} not found` },
      { status: 404 },
    );
  }

  if (order.status !== "success") {
    return NextResponse.json(
      {
        ok: false,
        error: `Order ${orderId} is not in success status (current: ${order.status})`,
      },
      { status: 409 },
    );
  }

  console.log("[admin:rescue] running provisionIfNeeded", { order: orderId });

  const result = await provisionIfNeeded(order);

  if (result === null) {
    return NextResponse.json({
      ok: true,
      orderId,
      skipped: true,
      reason: order.provisioning
        ? "already provisioned"
        : "awaiting domain registration",
      provisioning: order.provisioning ?? null,
    });
  }

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, orderId, error: result.error },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    orderId,
    username: result.username,
    domain: result.domain,
    package: result.package,
    ip: result.ip,
  });
}
