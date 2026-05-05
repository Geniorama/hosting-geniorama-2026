-- Hosting Geniorama — coupon columns on orders
-- Run this in the Supabase SQL editor (or via `supabase db push`).

alter table public.orders
  add column if not exists subtotal        integer,
  add column if not exists coupon_code     text,
  add column if not exists coupon_discount integer not null default 0;

create index if not exists orders_coupon_code_idx on public.orders (coupon_code);
