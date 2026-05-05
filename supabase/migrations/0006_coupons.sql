-- Hosting Geniorama — coupons table
-- Run this in the Supabase SQL editor (or via `supabase db push`).

create table if not exists public.coupons (
  code         text primary key,
  label        text not null,
  type         text not null,
  percent_off  integer,
  amount_off   integer,
  applies_to   text,
  min_amount   integer,
  max_uses     integer,
  uses_count   integer not null default 0,
  starts_at    timestamptz,
  expires_at   timestamptz,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint coupons_type_check check (type in ('percent', 'amount')),
  constraint coupons_applies_to_check check (applies_to is null or applies_to in ('monthly', 'annual')),
  constraint coupons_percent_check check (
    (type = 'percent' and percent_off is not null and percent_off between 1 and 100)
    or type <> 'percent'
  ),
  constraint coupons_amount_check check (
    (type = 'amount' and amount_off is not null and amount_off > 0)
    or type <> 'amount'
  )
);

-- normalize the code to uppercase
create or replace function public.coupons_normalize_code()
returns trigger language plpgsql as $$
begin
  new.code = upper(trim(new.code));
  return new;
end;
$$;

drop trigger if exists coupons_normalize_code on public.coupons;
create trigger coupons_normalize_code
before insert or update on public.coupons
for each row execute function public.coupons_normalize_code();

drop trigger if exists coupons_set_updated_at on public.coupons;
create trigger coupons_set_updated_at
before update on public.coupons
for each row execute function public.set_updated_at();

create index if not exists coupons_active_idx on public.coupons (active) where active = true;

-- atomically reserve one use of a coupon — returns the row if it succeeds,
-- nothing if the coupon is exhausted, expired, or inactive.
create or replace function public.redeem_coupon(p_code text)
returns public.coupons
language plpgsql
as $$
declare
  result public.coupons;
begin
  update public.coupons
     set uses_count = uses_count + 1
   where code = upper(trim(p_code))
     and active = true
     and (starts_at is null or starts_at <= now())
     and (expires_at is null or expires_at > now())
     and (max_uses is null or uses_count < max_uses)
   returning * into result;
  return result;
end;
$$;

-- RLS: lock the table; only the service role can read and write.
alter table public.coupons enable row level security;
revoke all on public.coupons from anon, authenticated;
revoke all on function public.redeem_coupon(text) from anon, authenticated;

-- Seed a few sample coupons (idempotent).
insert into public.coupons (code, label, type, percent_off)
values
  ('GENIO10', '10% de descuento', 'percent', 10),
  ('BIENVENIDA20', '20% de descuento de bienvenida', 'percent', 20)
on conflict (code) do nothing;

insert into public.coupons (code, label, type, percent_off, applies_to)
values ('ANUAL15', '15% extra en plan anual', 'percent', 15, 'annual')
on conflict (code) do nothing;

insert into public.coupons (code, label, type, amount_off, min_amount)
values ('AHORRO50', '$50.000 COP de descuento', 'amount', 50000, 100000)
on conflict (code) do nothing;
