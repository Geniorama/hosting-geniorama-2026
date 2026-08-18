import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { orderStore } from "@/lib/order-store";
import { completeProvisioning, packageForPlan } from "@/lib/whm";

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Completes provisioning for an order whose cPanel account was created
 * MANUALLY in another reseller (e.g. when the primary reseller is full).
 *
 * It does NOT touch WHM. Given the account details you set by hand, it runs the
 * remaining steps automatically: persists the provisioning info, emails the
 * customer their credentials, syncs to tickets, and creates the Trello card.
 *
 * Auth: Bearer <RESCUE_SECRET> (same secret as /api/admin/rescue-order).
 *
 * Body: {
 *   orderId: string,        // required
 *   username: string,       // required — cPanel username you created
 *   password: string,       // required — password you assigned
 *   ip?: string,            // server IP of the reseller (recommended)
 *   domain?: string,        // defaults to the order's hosting domain
 *   package?: string,       // defaults to packageForPlan(order plan)
 *   panel?: "cpanel"|"plesk", // control panel for the credentials email (default "cpanel")
 *   ns1?: string, ns2?: string, // nameservers for the email (optional)
 *   webmailUrl?: string,    // override webmail URL in the email (optional)
 *   showNameservers?: boolean, // include the nameserver section (default: true cPanel / false Plesk)
 *   skipEmail?: boolean,    // don't send the credentials email (e.g. retrying a failed tickets sync)
 *   force?: boolean,        // proceed even if the order is already provisioned (re-runs idempotent steps)
 * }
 */
export async function POST(req: Request) {
  const expected = process.env.RESCUE_SECRET;
  if (!expected) {
    console.error("[admin:complete] RESCUE_SECRET not configured");
    return new NextResponse("Not configured", { status: 503 });
  }

  const auth = req.headers.get("authorization") ?? "";
  const presented = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (!presented || !constantTimeEquals(presented, expected)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let body: {
    orderId?: unknown;
    username?: unknown;
    password?: unknown;
    ip?: unknown;
    domain?: unknown;
    package?: unknown;
    panel?: unknown;
    ns1?: unknown;
    ns2?: unknown;
    webmailUrl?: unknown;
    showNameservers?: unknown;
    skipEmail?: unknown;
    force?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const ip = typeof body.ip === "string" ? body.ip.trim() : undefined;
  const domainOverride = typeof body.domain === "string" ? body.domain.trim() : "";
  const packageOverride = typeof body.package === "string" ? body.package.trim() : "";
  const panel = body.panel === "plesk" ? "plesk" : "cpanel";
  const ns1 = typeof body.ns1 === "string" && body.ns1.trim() ? body.ns1.trim() : undefined;
  const ns2 = typeof body.ns2 === "string" && body.ns2.trim() ? body.ns2.trim() : undefined;
  const webmailUrl =
    typeof body.webmailUrl === "string" && body.webmailUrl.trim()
      ? body.webmailUrl.trim()
      : undefined;
  const showNameservers =
    typeof body.showNameservers === "boolean" ? body.showNameservers : undefined;
  const skipEmail = body.skipEmail === true;
  const force = body.force === true;

  if (!orderId) {
    return NextResponse.json({ ok: false, error: "Missing orderId" }, { status: 400 });
  }
  if (!username) {
    return NextResponse.json({ ok: false, error: "Missing username" }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ ok: false, error: "Missing password" }, { status: 400 });
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

  if (order.provisioning && !force) {
    return NextResponse.json(
      {
        ok: false,
        error: `Order ${orderId} is already provisioned (pass "force": true to re-run the remaining idempotent steps)`,
        provisioning: order.provisioning,
      },
      { status: 409 },
    );
  }

  const domain = domainOverride || order.payload.hosting.domain;
  const pkg = packageOverride || packageForPlan(order.payload.planId);

  console.log("[admin:complete] completing manual provisioning", {
    order: orderId,
    username,
    domain,
    package: pkg,
    panel,
    force,
    skipEmail,
  });

  try {
    await completeProvisioning(
      order,
      {
        ok: true,
        username,
        domain,
        password,
        package: pkg,
        ip,
        raw: { source: "manual", reseller: "external", panel },
      },
      { panel, ns1, ns2, webmailUrl, showNameservers },
      { skipCredentialsEmail: skipEmail, provider: "manual" },
    );
  } catch (err) {
    console.error("[admin:complete] completeProvisioning threw", err);
    return NextResponse.json(
      { ok: false, orderId, error: (err as Error).message },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    orderId,
    username,
    domain,
    package: pkg,
    ip: ip ?? null,
    panel,
  });
}
