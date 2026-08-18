-- Billing period + renewal tracking.
--
-- Until now nothing in this database knew when a service expired: the only
-- record was the due date printed on the Trello card and the expiresAt the
-- tickets app returned. That made "what expires this month?" impossible to
-- answer with a query, and there was nothing to drive renewal reminders.

alter table public.orders
  add column if not exists period_start   timestamptz,
  add column if not exists period_end     timestamptz,
  -- Id of the order this one renews. Set when a paid order is recognised as a
  -- renewal instead of a new signup, so provisioning is skipped.
  add column if not exists renewal_of     text,
  -- Which renewal notices already went out, e.g. {"d30": "2026-08-18T...Z"}.
  -- Keyed so the cron can run many times a day and stay idempotent.
  add column if not exists renewal_notices jsonb not null default '{}'::jsonb,
  -- Set when the grace period ran out and the team was asked to suspend.
  add column if not exists suspended_at   timestamptz;

-- The renewal cron scans for periods ending soon or already past, and only
-- ever cares about orders that were actually paid.
create index if not exists orders_period_end_idx
  on public.orders (period_end)
  where status = 'success';

-- Finding the live service for a domain (renewal detection).
create index if not exists orders_domain_idx
  on public.orders ((payload -> 'hosting' ->> 'domain'))
  where status = 'success';
