-- Hosting Geniorama — orders table
-- Run this in the Supabase SQL editor (or via `supabase db push`).

create table if not exists public.orders (
  id           text primary key,
  status       text not null default 'created',
  amount       integer not null,
  payload      jsonb not null,
  payment_ref  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint orders_status_check check (
    status in ('created', 'success', 'pending', 'failed', 'cancelled', 'refunded')
  )
);

create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_at_idx on public.orders (created_at desc);

-- auto-update updated_at on row change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

-- RLS: lock the table; only the service role (used by server actions / route
-- handlers) can read and write. The anon key has no access.
alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;
