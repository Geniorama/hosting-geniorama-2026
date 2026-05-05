-- Hosting Geniorama — store the billing name as separate first/last fields.
-- Run this in the Supabase SQL editor (or via `supabase db push`).

alter table public.orders
  add column if not exists legal_first_name text,
  add column if not exists legal_last_name  text;
