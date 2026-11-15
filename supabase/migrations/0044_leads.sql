-- November 15: Michael's leads (women he's talking to who aren't clients yet). Coach only.
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  first_name text not null default '',
  last_name text not null default '',
  email text,
  phone text,
  city text,
  goals text,
  notes text,
  source text not null default 'manual',   -- manual, upload; later: ads, opt-in
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leads_created on public.leads (created_at desc);
alter table public.leads enable row level security;
drop policy if exists "coach only" on public.leads;
create policy "coach only" on public.leads for all using (public.is_coach()) with check (public.is_coach());
