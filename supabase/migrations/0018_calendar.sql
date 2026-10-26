-- Calendar (October 26): her workout days, Real Talk Tuesday (Zoom link and replays). Safe to run more than once.
alter table public.profiles add column if not exists workout_days smallint[];   -- 0 = Sunday … 6 = Saturday

-- Program-wide settings everyone can read and only Michael can change (e.g. the Real Talk Tuesday Zoom link).
create table if not exists public.program_settings (key text primary key, value text);
alter table public.program_settings enable row level security;
drop policy if exists "read program settings" on public.program_settings;
drop policy if exists "coach writes program settings" on public.program_settings;
create policy "read program settings" on public.program_settings for select using (auth.uid() is not null);
create policy "coach writes program settings" on public.program_settings for all using (public.is_coach()) with check (public.is_coach());

-- One row per Real Talk Tuesday that has something to show: a replay, a topic, or "no call this week".
create table if not exists public.calls (
  call_date date primary key,
  title text,
  replay_url text,
  cancelled boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.calls enable row level security;
drop policy if exists "read calls" on public.calls;
drop policy if exists "coach writes calls" on public.calls;
create policy "read calls" on public.calls for select using (auth.uid() is not null);
create policy "coach writes calls" on public.calls for all using (public.is_coach()) with check (public.is_coach());
