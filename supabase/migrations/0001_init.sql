-- DWTP app: initial database schema
-- Mirrors the program design: Capacity Circles (doc 23), the 26-week Main Trajectory (doc 27),
-- weekly check-ins (doc 28), the 7X Assessment (doc 29) and the app plan (doc 24).

-- ─────────────────────────────────────────────
-- People
-- ─────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'client' check (role in ('client', 'coach')),
  full_name text,
  email text,
  phone text,
  timezone text not null default 'America/Los_Angeles',
  plan text check (plan in ('26_weeks', '52_weeks', 'monthly')),
  program_start date,                 -- always the Monday after signup
  status text not null default 'onboarding' check (status in ('onboarding', 'active', 'paused', 'completed', 'cancelled')),
  wake_time time,
  bedtime time,
  start_weight_lbs numeric(5,1),
  goal_weight_lbs numeric(5,1),
  strength_days_per_week int check (strength_days_per_week between 1 and 3),
  samcart_order_id text,
  created_at timestamptz not null default now()
);

create or replace function public.is_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'coach');
$$;

-- ─────────────────────────────────────────────
-- Program content (written by Michael, read by everyone)
-- ─────────────────────────────────────────────
create table public.circles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  kind text not null check (kind in ('growth', 'fixit_event', 'fixit_ongoing')),
  method_part text,                    -- circadian_reset / metabolism_fix / proper_strength_training / lifestyle
  goal text,
  see_a_professional text,             -- referral rules (fix-its, Circadian Reset)
  sort int not null default 0
);

create table public.rings (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  ring_number int not null,
  name text not null,
  outcome text,
  cps int not null default 50,
  unique (circle_id, ring_number)
);

create table public.ring_items (
  id uuid primary key default gen_random_uuid(),
  ring_id uuid not null references public.rings (id) on delete cascade,
  item_type text not null check (item_type in ('do', 'eat', 'take', 'get', 'learn', 'hit')),
  cadence text not null default 'daily' check (cadence in ('daily', 'weekly', 'once')),
  title text not null,
  detail text,
  also_counts_in uuid references public.ring_items (id),  -- e.g. blackout shades count in Healthy Home too
  sort int not null default 0
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('hh', 'sbw', 'smf', 'other')),
  number int,
  title text not null,
  video_url text,
  body text,
  quiz_question text,                  -- the check-in lesson question (doc 28)
  ring_id uuid references public.rings (id),
  retired boolean not null default false
);

create table public.trajectory_weeks (
  week_number int primary key check (week_number between 1 and 52),
  phase text not null check (phase in ('rested', 'fueled', 'driven', 'continuation')),
  sbw_lesson_id uuid references public.lessons (id),
  smf_lesson_id uuid references public.lessons (id),
  checkin_type text not null default 'standard'
    check (checkin_type in ('week1', 'standard', 'four_week', 'milestone', 'halfway', 'last_chance', 'results')),
  checkin_is_video boolean not null default false,
  is_diet_break boolean not null default false,
  moments text[] not null default '{}'  -- e.g. {'upsell_2','sleep_better_checkpoint'}
);

create table public.trajectory_week_rings (
  week_number int references public.trajectory_weeks (week_number) on delete cascade,
  ring_id uuid references public.rings (id) on delete cascade,
  primary key (week_number, ring_id)
);

-- ─────────────────────────────────────────────
-- Her progress
-- ─────────────────────────────────────────────
create table public.client_focus_circles (
  client_id uuid references public.profiles (id) on delete cascade,
  circle_id uuid references public.circles (id) on delete cascade,
  primary key (client_id, circle_id)
);

create table public.client_rings (
  client_id uuid references public.profiles (id) on delete cascade,
  ring_id uuid references public.rings (id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'complete')),
  opened_on date not null default current_date,
  completed_on date,
  primary key (client_id, ring_id)
);

create table public.client_items (
  client_id uuid references public.profiles (id) on delete cascade,
  item_id uuid references public.ring_items (id) on delete cascade,
  streak int not null default 0,       -- days (daily) or weeks (weekly); 14 days / 2 weeks completes it
  completed_on date,
  signed_off_by uuid references public.profiles (id),  -- Hit items
  primary key (client_id, item_id)
);

create table public.habit_logs (
  client_id uuid references public.profiles (id) on delete cascade,
  item_id uuid references public.ring_items (id) on delete cascade,
  log_date date not null,
  done boolean not null default true,
  primary key (client_id, item_id, log_date)
);

create table public.weight_logs (
  client_id uuid references public.profiles (id) on delete cascade,
  log_date date not null,
  weight_lbs numeric(5,1) not null,
  primary key (client_id, log_date)
);

create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  eaten_at timestamptz not null default now(),
  meal_slot text check (meal_slot in ('meal_1', 'meal_2', 'meal_3', 'other')),
  source text not null check (source in ('photo', 'voice', 'text', 'saved_meal')),
  description text,
  photo_path text,                     -- Supabase Storage, private bucket
  items jsonb not null default '[]',   -- [{name, amount, calories, protein_g, fiber_g, potassium_mg}]
  calories int,
  protein_g numeric(6,1),
  fiber_g numeric(6,1),
  potassium_mg int,
  confirmed boolean not null default false  -- she confirms or adjusts the AI estimate
);
create index on public.food_logs (client_id, eaten_at);

create table public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,                  -- her Favorite Three, Backup Three…
  kind text check (kind in ('favorite', 'backup', 'other')),
  items jsonb not null default '[]',
  calories int, protein_g numeric(6,1), fiber_g numeric(6,1), potassium_mg int
);

create table public.nutrition_targets (
  client_id uuid primary key references public.profiles (id) on delete cascade,
  maintenance_calories int,
  calorie_target int,
  protein_g int,
  set_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create table public.assessments (
  client_id uuid primary key references public.profiles (id) on delete cascade,
  answers jsonb not null default '{}', -- 7X answers (doc 29); videos in Storage
  ai_summary text,
  submitted_at timestamptz
);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  week_number int not null,
  sleep int check (sleep between 1 and 10),
  energy int check (energy between 1 and 10),
  stress int check (stress between 1 and 10),
  hunger int check (hunger between 1 and 10),
  answers jsonb not null default '{}',
  video_path text,
  transcript text,
  ai_summary jsonb,                    -- {win, obstacle, questions, flags}
  submitted_at timestamptz not null default now(),
  unique (client_id, week_number)
);

create table public.checkin_replies (
  checkin_id uuid primary key references public.checkins (id) on delete cascade,
  ai_draft text,
  final_text text,
  video_url text,
  sent_at timestamptz
);

create table public.cp_ledger (
  id bigint generated always as identity primary key,
  client_id uuid not null references public.profiles (id) on delete cascade,
  points int not null,
  reason text not null,                -- habit / checkin / lesson / ring / circle / milestone
  source_id uuid,
  created_at timestamptz not null default now()
);
create index on public.cp_ledger (client_id, created_at);

-- ─────────────────────────────────────────────
-- Community and messaging (replaces WhatsApp)
-- ─────────────────────────────────────────────
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  photo_path text,
  created_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.likes (
  post_id uuid references public.posts (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  primary key (post_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,  -- the 1:1 thread with Michael
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text,
  attachment_path text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index on public.messages (client_id, created_at);

-- ─────────────────────────────────────────────
-- Row-level security: each client sees only her own data; Michael (coach) sees everything.
-- ─────────────────────────────────────────────
alter table public.profiles enable row level security;
create policy "own profile or coach" on public.profiles for select using (id = auth.uid() or public.is_coach());
create policy "community names" on public.profiles for select using (auth.uid() is not null);
create policy "update own profile" on public.profiles for update using (id = auth.uid() or public.is_coach());

-- Content: readable by signed-in users, written by the coach.
do $$
declare t text;
begin
  foreach t in array array['circles','rings','ring_items','lessons','trajectory_weeks','trajectory_week_rings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "read content" on public.%I for select using (auth.uid() is not null)', t);
    execute format('create policy "coach writes content" on public.%I for all using (public.is_coach()) with check (public.is_coach())', t);
  end loop;
end $$;

-- Her data: her rows, plus the coach.
do $$
declare t text;
begin
  foreach t in array array['client_focus_circles','client_rings','client_items','habit_logs','weight_logs','food_logs',
                           'saved_meals','nutrition_targets','assessments','checkins','cp_ledger'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all using (client_id = auth.uid() or public.is_coach()) with check (client_id = auth.uid() or public.is_coach())', t);
  end loop;
end $$;

alter table public.checkin_replies enable row level security;
create policy "reply to own checkin" on public.checkin_replies for select
  using (public.is_coach() or exists (select 1 from public.checkins c where c.id = checkin_id and c.client_id = auth.uid() and checkin_replies.sent_at is not null));
create policy "coach writes replies" on public.checkin_replies for all using (public.is_coach()) with check (public.is_coach());

alter table public.messages enable row level security;
create policy "own thread" on public.messages for all
  using (client_id = auth.uid() or public.is_coach())
  with check ((client_id = auth.uid() and sender_id = auth.uid()) or public.is_coach());

alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
create policy "members read posts" on public.posts for select using (auth.uid() is not null);
create policy "write own posts" on public.posts for insert with check (author_id = auth.uid());
create policy "edit own posts" on public.posts for update using (author_id = auth.uid() or public.is_coach());
create policy "delete own posts" on public.posts for delete using (author_id = auth.uid() or public.is_coach());
create policy "members read comments" on public.comments for select using (auth.uid() is not null);
create policy "write own comments" on public.comments for insert with check (author_id = auth.uid());
create policy "delete own comments" on public.comments for delete using (author_id = auth.uid() or public.is_coach());
create policy "members read likes" on public.likes for select using (auth.uid() is not null);
create policy "own likes" on public.likes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Leaderboard: weekly CPs per client (always-visible tab; this week by default).
create or replace view public.leaderboard_this_week with (security_invoker = false) as
  select p.id as client_id, p.full_name, coalesce(sum(l.points), 0) as cps
  from public.profiles p
  left join public.cp_ledger l on l.client_id = p.id and l.created_at >= date_trunc('week', now())
  where p.role = 'client' and p.status = 'active'
  group by p.id, p.full_name;
