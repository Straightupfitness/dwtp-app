-- November 17 (Michael): an optional menstrual cycle tracker, so she can choose how hard to lift.
-- cycle_tracking on her profile: null = off, 'period' = she logs her period, 'symptoms' = no period
-- (perimenopause / menopause): daily energy and symptoms only.
alter table public.profiles add column if not exists cycle_tracking text check (cycle_tracking in ('period', 'symptoms'));

-- Her periods: the day each one started (and ended).
create table if not exists public.cycle_periods (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  start_date date not null,
  end_date date,
  created_at timestamptz not null default now(),
  unique (client_id, start_date)
);
-- A quick daily check: energy (1 to 5), symptoms, and how hard she chose to lift today.
create table if not exists public.cycle_days (
  client_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  energy int check (energy between 1 and 5),
  symptoms text[] not null default '{}',
  intensity text check (intensity in ('heavy', 'normal', 'lighter')),
  updated_at timestamptz not null default now(),
  primary key (client_id, day)
);
alter table public.cycle_periods enable row level security;
alter table public.cycle_days enable row level security;
drop policy if exists "own rows" on public.cycle_periods;
create policy "own rows" on public.cycle_periods for all
  using (client_id = auth.uid() or public.is_coach()) with check (client_id = auth.uid());
drop policy if exists "own rows" on public.cycle_days;
create policy "own rows" on public.cycle_days for all
  using (client_id = auth.uid() or public.is_coach()) with check (client_id = auth.uid());
