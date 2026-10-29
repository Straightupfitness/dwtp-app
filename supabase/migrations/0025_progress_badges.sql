-- Progress, water, badges, purchases and chat likes (October 29 feedback). Safe to run more than once.

-- ♥ on a chat message (the other person's).
alter table public.messages add column if not exists hearted_at timestamptz;

-- Water: her ounces for the day, added with one tap (+8, +16, +32 oz).
create table if not exists public.water_days (
  client_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  oz int not null default 0 check (oz >= 0 and oz <= 1000),
  updated_at timestamptz not null default now(),
  primary key (client_id, day)
);
alter table public.water_days enable row level security;
drop policy if exists "own rows" on public.water_days;
create policy "own rows" on public.water_days for all using (client_id = auth.uid() or public.is_coach()) with check (client_id = auth.uid() or public.is_coach());

-- Her goals beyond weight: fiber and potassium (defaults 30 g and 4,700 mg), water (1 gallon) and steps (10,000).
alter table public.nutrition_targets add column if not exists fiber_g int;
alter table public.nutrition_targets add column if not exists potassium_mg int;
alter table public.profiles add column if not exists water_goal_oz int not null default 128;
alter table public.profiles add column if not exists step_goal int not null default 10000;

-- What she bought: Michael types it in on her page. Only the coach sees it.
create table if not exists public.client_purchases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  offer text not null,                   -- "Driven Woman Transformation Program, 26 weeks"
  amount_paid numeric(10,2),
  purchased_on date,
  starts_on date,
  expires_on date,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists client_purchases_client on public.client_purchases (client_id, purchased_on desc);
alter table public.client_purchases enable row level security;
drop policy if exists "coach only" on public.client_purchases;
create policy "coach only" on public.client_purchases for all using (public.is_coach()) with check (public.is_coach());

-- Badges she earned (21 days in a row of something). Everyone signed in can see them: they show next to her name in Community.
-- The app awards them with the service key, so a badge can't be added from the browser.
create table if not exists public.badges_earned (
  client_id uuid not null references public.profiles (id) on delete cascade,
  badge text not null,
  earned_at timestamptz not null default now(),
  primary key (client_id, badge)
);
alter table public.badges_earned enable row level security;
drop policy if exists "members read badges" on public.badges_earned;
create policy "members read badges" on public.badges_earned for select using (auth.uid() is not null);
drop policy if exists "coach writes badges" on public.badges_earned;
create policy "coach writes badges" on public.badges_earned for all using (public.is_coach()) with check (public.is_coach());

select 'ok' as progress_badges;
