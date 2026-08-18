/**
 * Single source of truth for how long a paid period lasts.
 *
 * The Trello card, the renewal reminders and the expiry check all derive their
 * dates from here, so a change to the cycle length can never leave the invoice
 * saying one thing and the reminder another.
 */

export type Billing = "monthly" | "annual";

export function periodLengthDays(billing: Billing): number {
  return billing === "annual" ? 365 : 30;
}

export function computePeriodEnd(startMs: number, billing: Billing): Date {
  const d = new Date(startMs);
  d.setUTCDate(d.getUTCDate() + periodLengthDays(billing));
  return d;
}

/** Whole days from now until `end`. Negative once the period has passed. */
export function daysUntil(end: Date, nowMs = Date.now()): number {
  return Math.ceil((end.getTime() - nowMs) / (24 * 60 * 60 * 1000));
}

/**
 * Days before expiry on which the customer gets a reminder. Configurable so the
 * cadence can be tuned without a deploy; defaults to a month, two weeks and
 * five days out.
 */
export function reminderDays(): number[] {
  const raw = process.env.RENEWAL_REMINDER_DAYS;
  const parsed = (raw ?? "30,15,5")
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  // Ascending, so `find(d => daysLeft <= d)` returns the tightest window the
  // service has already entered — a service first seen 3 days out gets the
  // 5-day notice, not the 30-day one it technically also crossed.
  return [...new Set(parsed)].sort((a, b) => a - b);
}

/** The tightest reminder window `daysLeft` has entered, if any. */
export function reminderWindowFor(daysLeft: number): number | undefined {
  return reminderDays().find((d) => daysLeft <= d);
}

/** Days after expiry before the team is asked to suspend the account. */
export function graceDays(): number {
  const n = Number.parseInt(process.env.RENEWAL_GRACE_DAYS ?? "5", 10);
  return Number.isFinite(n) && n >= 0 ? n : 5;
}
