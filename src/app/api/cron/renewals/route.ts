import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { runRenewalSweep } from "@/lib/renewals";

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Daily renewal sweep: reminders before expiry, an expiry notice, and a
 * suspension work order once the grace period runs out.
 *
 * Triggered by the Netlify Scheduled Function in
 * netlify/functions/renewals-cron.mts, which calls this route with
 * `Authorization: Bearer $CRON_SECRET`. RESCUE_SECRET is also accepted so the
 * sweep can be run by hand with the same token as the other admin endpoints.
 *
 * Every notice is recorded on the order, so running it twice sends nothing
 * twice — safe to retry and safe to trigger manually while testing. Netlify
 * caps function duration, so each run sends at most RENEWAL_SWEEP_LIMIT notices
 * and reports `truncated: true` when it left work for the next run.
 */
export async function GET(req: Request) {
  const accepted = [process.env.CRON_SECRET, process.env.RESCUE_SECRET].filter(
    (s): s is string => Boolean(s),
  );
  if (!accepted.length) {
    console.error("[cron:renewals] neither CRON_SECRET nor RESCUE_SECRET configured");
    return new NextResponse("Not configured", { status: 503 });
  }

  const auth = req.headers.get("authorization") ?? "";
  const presented = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (!presented || !accepted.some((secret) => constantTimeEquals(presented, secret))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // ?dryRun=1 reports what would be sent without sending anything, by looking
  // only one day into the past — useful for a first run in production.
  const url = new URL(req.url);
  if (url.searchParams.get("dryRun") === "1") {
    const { orderStore } = await import("@/lib/order-store");
    const { daysUntil, reminderDays, graceDays } = await import("@/lib/billing-period");
    const windows = reminderDays();
    const horizonDays = windows.length ? Math.max(...windows) : 30;
    const due = await orderStore.listExpiringBefore(Date.now() + horizonDays * 86_400_000);
    return NextResponse.json({
      dryRun: true,
      reminderDays: windows,
      graceDays: graceDays(),
      candidates: due.map((o) => ({
        orderId: o.id,
        domain: o.payload.hosting.domain,
        periodEnd: o.periodEnd ? new Date(o.periodEnd).toISOString() : null,
        daysLeft: o.periodEnd ? daysUntil(new Date(o.periodEnd)) : null,
        noticesSent: Object.keys(o.renewalNotices ?? {}),
      })),
    });
  }

  const report = await runRenewalSweep();
  return NextResponse.json(report, { status: report.errors.length ? 207 : 200 });
}
