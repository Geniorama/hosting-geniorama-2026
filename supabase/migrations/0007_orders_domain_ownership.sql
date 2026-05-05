-- Hosting Geniorama — track whether the customer already owns the domain.
-- Run this in the Supabase SQL editor (or via `supabase db push`).

alter table public.orders
  add column if not exists domain_ownership text;

alter table public.orders
  drop constraint if exists orders_domain_ownership_check;

alter table public.orders
  add constraint orders_domain_ownership_check
    check (domain_ownership is null or domain_ownership in ('owned', 'not-yet'));

create index if not exists orders_domain_ownership_idx
  on public.orders (domain_ownership);
