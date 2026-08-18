import {
  computePeriodEnd,
  daysUntil,
  graceDays,
  reminderDays,
  reminderWindowFor,
} from "./billing-period";
import {
  sendRenewalConfirmed,
  sendRenewalReminder,
  sendServiceExpiredNotice,
  sendSuspensionWorkOrder,
} from "./mail-templates";
import { orderStore, type Order } from "./order-store";
import { createInvoiceCard } from "./trello";
import { provisionIfNeeded, type WhmCreateAcctResult } from "./whm";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Link the customer follows to pay the next period.
 *
 * For now it drops them into the normal checkout with the plan preselected, so
 * they retype their billing details. A `?renew=<orderId>` flow that prefills
 * from the previous order is the natural follow-up.
 */
export function renewalUrl(order: Order): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL ?? "https://hosting.geniorama.co").replace(
    /\/$/,
    "",
  );
  const params = new URLSearchParams({
    plan: order.payload.planId,
    billing: order.payload.billing,
  });
  return `${base}/checkout?${params.toString()}`;
}

/**
 * Sets the paid period on an order, once. A renewal starts where the previous
 * period ends — paying early must not cost the customer the days they had
 * left — while a first signup starts the moment the payment cleared.
 */
async function ensureBillingPeriod(order: Order, previous?: Order | null): Promise<Order> {
  if (order.periodEnd) return order;

  const paidAt = order.updatedAt || Date.now();
  const startMs =
    previous?.periodEnd && previous.periodEnd > paidAt ? previous.periodEnd : paidAt;
  const endMs = computePeriodEnd(startMs, order.payload.billing).getTime();

  try {
    await orderStore.setBillingPeriod(order.id, startMs, endMs);
  } catch (err) {
    console.error("[renewals] failed to persist billing period", { order: order.id, err });
    return order;
  }

  console.log("[renewals] billing period set", {
    order: order.id,
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    renewal: Boolean(previous),
  });

  return { ...order, periodStart: startMs, periodEnd: endMs };
}

export type PaidOrderOutcome =
  | { kind: "renewal"; renews: string; periodEnd?: number }
  | {
      kind: "provisioned";
      /** null when provisioning was skipped (already done, or domain pending). */
      result: WhmCreateAcctResult | null;
      periodEnd?: number;
    };

/**
 * Entry point for every paid order — both payment webhooks and the admin rescue
 * endpoint go through here.
 *
 * It decides what a payment actually means before anything is provisioned. A
 * second payment for a domain that already has a live account is a RENEWAL: the
 * account exists, so creating it again would fail in WHM and, worse, would send
 * the customer a "we are setting up your hosting" email for a service they have
 * been using for a year.
 */
export async function handlePaidOrder(order: Order): Promise<PaidOrderOutcome> {
  const domain = order.payload.hosting.domain?.trim();

  let previous: Order | null = null;
  if (domain && !order.provisioning) {
    try {
      previous = await orderStore.findLatestProvisionedByDomain(domain, order.id);
    } catch (err) {
      // A lookup failure must not block provisioning — worst case we treat a
      // renewal as a new signup, which is the behaviour we had before.
      console.error("[renewals] renewal lookup failed", { order: order.id, err });
    }
  }

  if (previous) {
    const renewed = await completeRenewal(order, previous);
    return { kind: "renewal", renews: previous.id, periodEnd: renewed.periodEnd };
  }

  const withPeriod = await ensureBillingPeriod(order);
  const result = await provisionIfNeeded(withPeriod);
  return { kind: "provisioned", result, periodEnd: withPeriod.periodEnd };
}

/**
 * A renewal: no account creation, no credentials email. The service simply
 * gains another period, the customer gets a receipt, and the team gets the
 * Trello card to issue the invoice.
 */
async function completeRenewal(order: Order, previous: Order): Promise<Order> {
  console.log("[renewals] payment recognised as a renewal", {
    order: order.id,
    renews: previous.id,
    domain: order.payload.hosting.domain,
  });

  try {
    await orderStore.setRenewalOf(order.id, previous.id);
  } catch (err) {
    console.error("[renewals] failed to persist renewal link", { order: order.id, err });
  }

  const withPeriod = await ensureBillingPeriod(order, previous);

  // Carry the account details forward so the Trello card and any later lookup
  // show which account this period belongs to.
  if (previous.provisioning) {
    try {
      await orderStore.setProvisioning(order.id, {
        ...previous.provisioning,
        provisionedAt: previous.provisioning.provisionedAt,
      });
    } catch (err) {
      console.error("[renewals] failed to copy provisioning info", { order: order.id, err });
    }
  }

  const enriched: Order = {
    ...withPeriod,
    renewalOf: previous.id,
    provisioning: previous.provisioning,
  };

  try {
    await sendRenewalConfirmed(enriched);
  } catch (err) {
    console.error("[renewals] confirmation email failed", { order: order.id, err });
  }

  // The invoice still has to be issued, exactly as for a first payment.
  if (!enriched.invoiceTask) {
    try {
      const card = await createInvoiceCard(enriched);
      if (card.ok) {
        await orderStore.setInvoiceTask(order.id, {
          provider: "trello",
          cardId: card.id,
          url: card.shortUrl,
          createdAt: Date.now(),
        });
      } else {
        console.error("[renewals] trello card failed", { order: order.id, error: card.error });
      }
    } catch (err) {
      console.error("[renewals] trello card threw", { order: order.id, err });
    }
  }

  // NOTE: the tickets app is not notified. Its only integration endpoint is
  // /hosting-provisioned, which creates a service; extending an existing one
  // needs a renewal endpoint on that side.
  console.warn("[renewals] tickets app not updated — needs a renewal endpoint", {
    order: order.id,
    service: previous.ticketsSync?.serviceId ?? "unknown",
  });

  return enriched;
}

export type SweepAction = "reminder" | "expired" | "suspend" | "skipped";

export type SweepReport = {
  scanned: number;
  reminders: number;
  expired: number;
  suspensions: number;
  skipped: number;
  /** True when the batch limit was hit and orders were left for the next run. */
  truncated: boolean;
  errors: string[];
  details: Array<{ orderId: string; domain: string; daysLeft: number; action: SweepAction }>;
};

/**
 * How many notices one invocation may send.
 *
 * The site runs on Netlify, which caps function duration, and each notice is a
 * synchronous email. Bounding the batch keeps a backlog from timing out the
 * whole sweep — leftovers are picked up by the next run, and `truncated` says
 * so out loud rather than silently dropping them.
 */
function sweepLimit(): number {
  const n = Number.parseInt(process.env.RENEWAL_SWEEP_LIMIT ?? "25", 10);
  return Number.isFinite(n) && n > 0 ? n : 25;
}

/**
 * One pass of the renewal chase. Safe to run many times a day: every notice is
 * recorded in `renewal_notices` and never repeats.
 */
export async function runRenewalSweep(nowMs = Date.now()): Promise<SweepReport> {
  const report: SweepReport = {
    scanned: 0,
    reminders: 0,
    expired: 0,
    suspensions: 0,
    skipped: 0,
    truncated: false,
    errors: [],
    details: [],
  };

  const limit = sweepLimit();
  let sent = 0;

  const windows = reminderDays();
  const horizonDays = windows.length ? Math.max(...windows) : 30;
  const horizon = nowMs + horizonDays * DAY_MS;

  let candidates: Order[];
  try {
    candidates = await orderStore.listExpiringBefore(horizon);
  } catch (err) {
    report.errors.push(`listExpiringBefore: ${(err as Error).message}`);
    return report;
  }

  for (const order of candidates) {
    if (sent >= limit) {
      report.truncated = true;
      console.warn("[renewals] batch limit reached, deferring the rest to the next run", {
        limit,
        remaining: candidates.length - report.scanned,
      });
      break;
    }

    report.scanned += 1;
    const domain = order.payload.hosting.domain;
    if (!order.periodEnd) continue;

    const daysLeft = daysUntil(new Date(order.periodEnd), nowMs);

    // No account was ever created for this order (provisioning failed, or the
    // customer is still registering their domain). Chasing them to renew a
    // service they never received would be wrong; the failure alert already
    // put it in front of the team.
    if (!order.provisioning) {
      report.skipped += 1;
      report.details.push({ orderId: order.id, domain, daysLeft, action: "skipped" });
      continue;
    }

    try {
      // Already renewed: the newer order carries the live period now.
      const renewal = await orderStore.findRenewalOf(order.id);
      if (renewal) {
        report.skipped += 1;
        report.details.push({ orderId: order.id, domain, daysLeft, action: "skipped" });
        continue;
      }

      const notices = order.renewalNotices ?? {};

      if (daysLeft > 0) {
        const window = reminderWindowFor(daysLeft);
        if (window === undefined) continue;
        const key = `d${window}`;
        if (notices[key]) continue;

        await sendRenewalReminder(order, daysLeft, renewalUrl(order));
        await orderStore.markRenewalNotice(order.id, key);
        report.reminders += 1;
        sent += 1;
        report.details.push({ orderId: order.id, domain, daysLeft, action: "reminder" });
        continue;
      }

      // Past the end date.
      if (!notices.expired) {
        await sendServiceExpiredNotice(order, graceDays(), renewalUrl(order));
        await orderStore.markRenewalNotice(order.id, "expired");
        report.expired += 1;
        sent += 1;
        report.details.push({ orderId: order.id, domain, daysLeft, action: "expired" });
      }

      const suspendAt = order.periodEnd + graceDays() * DAY_MS;
      if (nowMs >= suspendAt && !notices.suspend) {
        await sendSuspensionWorkOrder(order);
        await orderStore.markRenewalNotice(order.id, "suspend");
        await orderStore.setSuspendedAt(order.id, nowMs);
        report.suspensions += 1;
        sent += 1;
        report.details.push({ orderId: order.id, domain, daysLeft, action: "suspend" });
      }
    } catch (err) {
      const message = `${order.id}: ${(err as Error).message}`;
      console.error("[renewals] sweep item failed", message);
      report.errors.push(message);
    }
  }

  console.log("[renewals] sweep done", {
    scanned: report.scanned,
    reminders: report.reminders,
    expired: report.expired,
    suspensions: report.suspensions,
    skipped: report.skipped,
    errors: report.errors.length,
  });

  return report;
}
