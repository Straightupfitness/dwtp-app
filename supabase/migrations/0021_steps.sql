-- Steps she types in on Today (October 27). The Apple Health Shortcut (0020) is switched off for now;
-- this is the part of it the app needs. Safe to run more than once, and safe if 0020 already ran.
create table if not exists public.health_days (
  client_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  steps int,
  sleep_minutes int,
  source text not null default 'manual',
  synced_at timestamptz not null default now(),
  primary key (client_id, day)
);
alter table public.health_days enable row level security;
drop policy if exists "read own health days" on public.health_days;
create policy "read own health days" on public.health_days for select using (client_id = auth.uid() or public.is_coach());
