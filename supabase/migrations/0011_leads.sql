-- Hosting Geniorama — leads captured by the AI advisor landing (/asesor)
-- Run this in the Supabase SQL editor (or via `supabase db push`) BEFORE
-- pointing paid traffic at the landing, or the lead form will fall back to
-- e-mail only.

create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text not null,
  -- Celular en formato E.164 (+573001234567), listo para wa.me.
  phone         text,
  -- Plan the advisor recommended when the visitor left their data. Not a FK:
  -- plans live in code (src/lib/plans.ts), not in the database.
  plan_id       text,
  billing       text,
  -- Where the lead came from: "asesor-landing", "asesor-home", ...
  source        text not null default 'asesor-landing',
  -- Full advisor conversation, so sales can pick up the context.
  conversation  jsonb,
  -- utm_source / utm_medium / utm_campaign / gclid / referrer captured from the
  -- landing URL, to measure which campaign actually brings buyers.
  utm           jsonb,
  status        text not null default 'new',
  created_at    timestamptz not null default now(),
  constraint leads_status_check check (status in ('new', 'contacted', 'won', 'lost')),
  constraint leads_billing_check check (billing is null or billing in ('monthly', 'annual'))
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_email_idx on public.leads (email);
create index if not exists leads_status_idx on public.leads (status);

-- RLS: same posture as orders. Only the service role (server route handlers)
-- touches this table; the anon key has no access.
alter table public.leads enable row level security;
revoke all on public.leads from anon, authenticated;
