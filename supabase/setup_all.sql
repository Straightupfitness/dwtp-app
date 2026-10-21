-- DWTP: complete database setup. Paste this whole file into the Supabase SQL Editor and click Run, once.

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
-- Create a profile row automatically whenever a user is added to Supabase Auth.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
-- Generated by scripts/build_seed.py from doc 23 (Capacity Circles). Do not edit by hand.
begin;
delete from public.circles;
insert into public.circles (id, slug, name, kind, method_part, goal, see_a_professional, sort) values ('4baec3cb-e836-569a-a93e-72bf756e047e', 'circadian-reset', 'Circadian Reset', 'growth', 'circadian_reset', 'she sleeps 7.5 hours through the night on a steady rhythm, wakes with energy, has no 3 PM crash, and caffeine is optional.', '- Loud snoring, gasping, or someone notices pauses in her breathing; or she''s very sleepy during the day despite 7.5 hours (possible sleep apnea).', 0);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('9a3e8c4e-6bb2-56bd-8f85-bd3bdda6959c', '4baec3cb-e836-569a-a93e-72bf756e047e', 1, 'The 3-Hour Window', 'Steadier morning energy; fewer 3 AM wakeups within a week');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('9a3e8c4e-6bb2-56bd-8f85-bd3bdda6959c', 'do', 'daily', 'Outside light within 30 min of waking', '2+ min; 10 if cloudy', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('9a3e8c4e-6bb2-56bd-8f85-bd3bdda6959c', 'eat', 'daily', '40 g+ protein within 60 min', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('9a3e8c4e-6bb2-56bd-8f85-bd3bdda6959c', 'do', 'daily', 'Move within 2 hrs', '15-min walk or strength session', 2);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('9a3e8c4e-6bb2-56bd-8f85-bd3bdda6959c', 'do', 'daily', 'No caffeine for 90 min after waking', null, 3);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('db1fbde6-cd3f-5e03-a35c-840c3026d00f', '4baec3cb-e836-569a-a93e-72bf756e047e', 2, 'Back to Sleep', 'Back asleep within 10 minutes when she wakes');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('db1fbde6-cd3f-5e03-a35c-840c3026d00f', 'learn', 'once', 'The Blinking Method', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('db1fbde6-cd3f-5e03-a35c-840c3026d00f', 'do', 'daily', 'The Blinking Method every time she wakes at night', 'nights without a wakeup count too', 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('db1fbde6-cd3f-5e03-a35c-840c3026d00f', 'do', 'daily', 'No snooze; up with the first alarm', null, 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('200cbae3-89df-59db-81df-3508e6f8eccf', '4baec3cb-e836-569a-a93e-72bf756e047e', 3, 'The No-Nap Nap', 'No 3 PM crash; less afternoon coffee');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('200cbae3-89df-59db-81df-3508e6f8eccf', 'eat', 'daily', '40 g+ protein lunch', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('200cbae3-89df-59db-81df-3508e6f8eccf', 'do', 'daily', '10–20 min NSDR around 2:30 PM + 3-min reactivation', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('200cbae3-89df-59db-81df-3508e6f8eccf', 'do', 'daily', '10-min walk after every meal', null, 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('fbd0ffa4-f406-5951-b123-0a3ab6ad9335', '4baec3cb-e836-569a-a93e-72bf756e047e', 4, 'Caffeine Rules', 'Less wired-and-tired; easier to fall asleep');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('fbd0ffa4-f406-5951-b123-0a3ab6ad9335', 'do', 'daily', 'Caffeine cutoff 10 hrs before bed', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('fbd0ffa4-f406-5951-b123-0a3ab6ad9335', 'do', 'daily', '300 mg caffeine max a day', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('fbd0ffa4-f406-5951-b123-0a3ab6ad9335', 'do', 'daily', 'Black coffee only', 'cinnamon, mushrooms or protein powder allowed', 2);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('fbd0ffa4-f406-5951-b123-0a3ab6ad9335', 'take', 'daily', 'L-theanine with caffeine', 'also counts in Supplements', 3);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('38b9f5cb-dfab-57b7-9001-19305d94f47a', '4baec3cb-e836-569a-a93e-72bf756e047e', 5, 'Shut It Down', 'Falls asleep faster; 6 solid hours');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('38b9f5cb-dfab-57b7-9001-19305d94f47a', 'do', 'daily', '10-3-2-1-0 nightly', '10 hrs no caffeine, 3 no food or alcohol, 2 no work, 1 no screens, 0 snoozes', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('38b9f5cb-dfab-57b7-9001-19305d94f47a', 'do', 'daily', '6+ hrs sleep', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('38b9f5cb-dfab-57b7-9001-19305d94f47a', 'get', 'once', 'Blackout shades', 'also Healthy Home', 2);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('38b9f5cb-dfab-57b7-9001-19305d94f47a', 'get', 'once', 'Tech-free bedroom: TV out, real alarm clock, phone charges in another room', 'also Healthy Home', 3);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('558eded8-e3c1-5f17-93db-bb1f8611c8b1', '4baec3cb-e836-569a-a93e-72bf756e047e', 6, 'Seven Hours', 'Wakes up less groggy');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('558eded8-e3c1-5f17-93db-bb1f8611c8b1', 'do', 'daily', '7+ hrs sleep', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('558eded8-e3c1-5f17-93db-bb1f8611c8b1', 'do', 'daily', 'Bedroom 65–68°F', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('558eded8-e3c1-5f17-93db-bb1f8611c8b1', 'do', 'daily', 'A pillow wall if her partner''s tossing wakes her', 'SBW 6', 2);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('558eded8-e3c1-5f17-93db-bb1f8611c8b1', 'get', 'once', 'Earplugs, an eye mask with a nose flap', 'no light gap) and an ergonomic pillow (H&H 15', 3);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('558eded8-e3c1-5f17-93db-bb1f8611c8b1', 'eat', 'daily', '2 sleep foods daily', 'egg yolks, red meat, yogurt, goji berries, tart cherry juice, 2 kiwis an hour before bed) (goji and tart cherry also count in Supplements', 4);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('4f52222a-4821-5a5e-97a2-cc5de7fa1152', '4baec3cb-e836-569a-a93e-72bf756e047e', 7, 'Seven and a Half', 'Deep sleep; better recovery from workouts');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('4f52222a-4821-5a5e-97a2-cc5de7fa1152', 'do', 'daily', '7.5 hrs sleep', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('4f52222a-4821-5a5e-97a2-cc5de7fa1152', 'do', 'daily', 'Evening light: outside at sunset, dim lights after dark', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('4f52222a-4821-5a5e-97a2-cc5de7fa1152', 'do', 'daily', '2,000 steps within 60 min of waking', null, 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('93a668d6-aacf-5b0f-91a6-2267d7c59900', '4baec3cb-e836-569a-a93e-72bf756e047e', 8, 'Steady Rhythm', 'Wakes before the alarm; weekends don''t wreck Monday');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('93a668d6-aacf-5b0f-91a6-2267d7c59900', 'do', 'daily', '7.5 hrs with the same bedtime and wake time (±30 min) 7 days a week', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('93a668d6-aacf-5b0f-91a6-2267d7c59900', 'do', 'daily', '30-min wind-down routine', 'stretch, read, holy basil yogurt', 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('8a2c37c3-f969-5b66-af91-4f5af7b8a3c5', '4baec3cb-e836-569a-a93e-72bf756e047e', 9, 'Energy Engine', 'All-day energy without needing coffee');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('8a2c37c3-f969-5b66-af91-4f5af7b8a3c5', 'do', 'weekly', '3 × 10-second sprints, 60 sec rest', 'also Cardio', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('8a2c37c3-f969-5b66-af91-4f5af7b8a3c5', 'do', 'weekly', '1 caffeine-free day with no crash', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('8a2c37c3-f969-5b66-af91-4f5af7b8a3c5', 'hit', 'once', '14 days of energy 8/10+ and no 3 PM crash', 'from check-ins', 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('261dc662-d53d-5f4c-a2f1-b9cd3b55157c', '4baec3cb-e836-569a-a93e-72bf756e047e', 10, 'Driven Rhythm (elite)', 'Sleep and energy hold up on trips, holidays and stressful weeks');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('261dc662-d53d-5f4c-a2f1-b9cd3b55157c', 'hit', 'once', '30 nights without a 3 AM wakeup', 'or back asleep within 10 min', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('261dc662-d53d-5f4c-a2f1-b9cd3b55157c', 'hit', 'once', 'Wakes before the alarm 5 of 7 days for 4 weeks', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('261dc662-d53d-5f4c-a2f1-b9cd3b55157c', 'do', 'daily', 'Keeps rings 1–8 during a travel or holiday week', null, 2);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('261dc662-d53d-5f4c-a2f1-b9cd3b55157c', 'learn', 'once', 'Travel and time-zone sleep protocol', 'hands off to the Travel fix-it', 3);
insert into public.circles (id, slug, name, kind, method_part, goal, see_a_professional, sort) values ('989367dc-467f-5dd0-b1af-1b0cd74f587b', 'food-quality', 'Food Quality', 'growth', 'metabolism_fix', null, null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('98fa0f5c-0658-51ff-b339-9112f735c0d0', '989367dc-467f-5dd0-b1af-1b0cd74f587b', 1, 'Water & Green', 'Fewer cravings, better digestion');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('98fa0f5c-0658-51ff-b339-9112f735c0d0', 'do', 'daily', '~1 gallon of water daily', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('98fa0f5c-0658-51ff-b339-9112f735c0d0', 'eat', 'daily', 'Dark green vegetables with most meals', 'spinach in her protein shake, steamed broccoli, asparagus in garlic grass-fed butter', 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('4010f7f7-ecfc-54b3-8f8c-0b58dddbef56', '989367dc-467f-5dd0-b1af-1b0cd74f587b', 2, 'Daily Carrot & Potato', 'Fuller on fewer calories');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('4010f7f7-ecfc-54b3-8f8c-0b58dddbef56', 'eat', 'daily', 'A carrot daily', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('4010f7f7-ecfc-54b3-8f8c-0b58dddbef56', 'eat', 'daily', 'A potato daily', 'boiled is the most filling food there is', 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('4010f7f7-ecfc-54b3-8f8c-0b58dddbef56', 'eat', 'daily', 'Bell peppers daily', null, 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('b8ba378d-8cad-5964-9535-4fee1d889076', '989367dc-467f-5dd0-b1af-1b0cd74f587b', 3, 'Protein Foods', 'Hitting protein gets easy');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('b8ba378d-8cad-5964-9535-4fee1d889076', 'eat', 'daily', 'Fat-free Greek yogurt daily', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('b8ba378d-8cad-5964-9535-4fee1d889076', 'eat', 'daily', '3+ whole eggs daily', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('b8ba378d-8cad-5964-9535-4fee1d889076', 'eat', 'weekly', 'Red meat 3x a week', null, 2);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('b8ba378d-8cad-5964-9535-4fee1d889076', 'eat', 'weekly', 'Fatty fish 2–3x a week', 'salmon, sardines', 3);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('6f693e9d-3a09-5d66-976b-dac9b1643444', '989367dc-467f-5dd0-b1af-1b0cd74f587b', 4, 'Potassium 4,700', 'Less bloating, steadier blood pressure');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('6f693e9d-3a09-5d66-976b-dac9b1643444', 'do', 'daily', '4,700 mg potassium daily (logged) from potatoes, sweet potatoes, bananas, spinach, avocado, white beans, coconut water, salmon, yogurt', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('6f693e9d-3a09-5d66-976b-dac9b1643444', 'eat', 'daily', 'Bone broth daily', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('e294e387-38a4-52af-9140-1e4edbbbbae1', '989367dc-467f-5dd0-b1af-1b0cd74f587b', 5, 'Fiber 30', 'Regular, full, steady blood sugar');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('e294e387-38a4-52af-9140-1e4edbbbbae1', 'do', 'daily', '30 g fiber daily', '10 g+ per meal) from raspberries, chia seeds, lentils, black beans, oats, pears, avocado, broccoli, plus a high-fiber cereal as "fiber insurance" (H&H 30', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('e294e387-38a4-52af-9140-1e4edbbbbae1', 'take', 'daily', 'Psyllium husk', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('e294e387-38a4-52af-9140-1e4edbbbbae1', 'eat', 'daily', 'Berries daily', null, 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('9a566d14-0747-5c43-b491-d9188c1e2b3a', '989367dc-467f-5dd0-b1af-1b0cd74f587b', 6, 'Supergreens', 'More nutrients per calorie');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('9a566d14-0747-5c43-b491-d9188c1e2b3a', 'eat', 'daily', 'Microgreens (broccoli or kale), watercress or broccoli sprouts daily', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('9a566d14-0747-5c43-b491-d9188c1e2b3a', 'eat', 'daily', 'Moringa powder in her shake', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('9a566d14-0747-5c43-b491-d9188c1e2b3a', 'eat', 'daily', 'Almonds daily', null, 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('335e2d0f-0ee7-56a1-98b6-ed5b0eaa5602', '989367dc-467f-5dd0-b1af-1b0cd74f587b', 7, 'Superchargers', 'Every meal works harder');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('335e2d0f-0ee7-56a1-98b6-ed5b0eaa5602', 'eat', 'daily', '3 superchargers daily: holy basil seeds, goji berries, pumpkin seeds, hemp hearts, chia seeds, cacao nibs', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('335e2d0f-0ee7-56a1-98b6-ed5b0eaa5602', 'eat', 'daily', 'Cinnamon on any food it fits', 'potatoes, oatmeal, shakes, yogurt; H&H 14', 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('335e2d0f-0ee7-56a1-98b6-ed5b0eaa5602', 'take', 'daily', '1 tbsp flaxseed oil daily', null, 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('57906ec9-e826-5693-828b-a849d4db253a', '989367dc-467f-5dd0-b1af-1b0cd74f587b', 8, 'Plant Variety', 'A stronger gut');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('57906ec9-e826-5693-828b-a849d4db253a', 'do', 'weekly', '30 different plants a week', 'fruits, vegetables, nuts, seeds, beans, herbs; based on the American Gut Project', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('57906ec9-e826-5693-828b-a849d4db253a', 'eat', 'daily', 'A fermented food daily', 'kefir, sauerkraut, kimchi', 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('31b2a316-b2d6-5d2b-904c-f15ff75af99c', '989367dc-467f-5dd0-b1af-1b0cd74f587b', 9, 'Food Quality Elite', 'Bloodwork shows it');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('31b2a316-b2d6-5d2b-904c-f15ff75af99c', 'hit', 'once', 'All daily targets (protein, fiber, potassium, water) for 30 days in a row', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('31b2a316-b2d6-5d2b-904c-f15ff75af99c', 'hit', 'once', 'Blood test with iron, B12, vitamin D and zinc in range', null, 1);
insert into public.circles (id, slug, name, kind, method_part, goal, see_a_professional, sort) values ('a35a50c6-f91b-531c-94b6-8ef8c458c322', 'food-philosophy', 'Food Philosophy', 'growth', 'metabolism_fix', null, null, 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('92c3f5ee-47ef-59e6-b53b-e5982b849ec3', 'a35a50c6-f91b-531c-94b6-8ef8c458c322', 1, 'Log It', 'She sees what she really eats');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('92c3f5ee-47ef-59e6-b53b-e5982b849ec3', 'do', 'daily', 'Eat whatever she wants, but log every meal and drink, alcohol included', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('92c3f5ee-47ef-59e6-b53b-e5982b849ec3', 'do', 'daily', 'Weigh in daily', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('a64da852-0a8d-5c1d-b78f-756fe922061a', 'a35a50c6-f91b-531c-94b6-8ef8c458c322', 2, 'Your Baseline', 'She knows her maintenance number');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('a64da852-0a8d-5c1d-b78f-756fe922061a', 'hit', 'once', 'Michael sets her maintenance calories from 14 days of logs', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('a64da852-0a8d-5c1d-b78f-756fe922061a', 'do', 'daily', 'Hit maintenance within 100 calories', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('665e0ead-370e-51d6-bbbb-688b5b484cc6', 'a35a50c6-f91b-531c-94b6-8ef8c458c322', 3, 'Protein', 'Fuller, stronger, fewer cravings');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('665e0ead-370e-51d6-bbbb-688b5b484cc6', 'do', 'daily', 'Hit her protein target daily', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('665e0ead-370e-51d6-bbbb-688b5b484cc6', 'do', 'daily', 'Eat the protein first at every meal', 'blunts the blood sugar spike', 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('c3d972f1-ba35-52d1-b44b-b434b2c10c23', 'a35a50c6-f91b-531c-94b6-8ef8c458c322', 4, 'Log Like a Pro', 'No more "mystery calories"');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('c3d972f1-ba35-52d1-b44b-b434b2c10c23', 'do', 'daily', 'Log ingredient by ingredient', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('c3d972f1-ba35-52d1-b44b-b434b2c10c23', 'do', 'daily', 'Log the tiny calories', 'sauces, cooking oil, butter, almonds, tiny bites', 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('ebe6a6b1-dac9-529e-910b-5c884e6c80c0', 'a35a50c6-f91b-531c-94b6-8ef8c458c322', 5, 'Smart Deficit', 'Steady fat loss of 1–2 lbs a week');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('ebe6a6b1-dac9-529e-910b-5c884e6c80c0', 'do', 'daily', 'Calories 15–20% below maintenance', 'never under 1,200', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('ebe6a6b1-dac9-529e-910b-5c884e6c80c0', 'learn', 'once', 'Diet breaks: 1 week at maintenance after every 8–12 weeks in a deficit, from here on', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('dba8feac-e929-5342-a9a0-7685906d0a91', 'a35a50c6-f91b-531c-94b6-8ef8c458c322', 6, 'Swaps', 'Same foods, more nutrients');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('dba8feac-e929-5342-a9a0-7685906d0a91', 'do', 'daily', 'Make Michael''s nutrient-dense swaps', '3 to start', 0);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('991ae2b0-9f65-5dc6-ab05-084faa6a08ac', 'a35a50c6-f91b-531c-94b6-8ef8c458c322', 7, 'Your Favorite Three', 'She loves what she eats');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('991ae2b0-9f65-5dc6-ab05-084faa6a08ac', 'do', 'daily', '3 favorite meals every day, each 40 g+ protein and 10 g+ fiber (e.g. Shake', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('991ae2b0-9f65-5dc6-ab05-084faa6a08ac', 'do', 'daily', 'MVP: meat, vegetables, potatoes', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('991ae2b0-9f65-5dc6-ab05-084faa6a08ac', 'do', 'daily', 'Yogurt bowl)', null, 2);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('991ae2b0-9f65-5dc6-ab05-084faa6a08ac', 'do', 'daily', 'Eat sitting down, with small cutlery', null, 3);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('8fbacca7-bbab-5d1a-81c3-dbacb28510f4', 'a35a50c6-f91b-531c-94b6-8ef8c458c322', 8, 'Backup Three', 'Life happens, she stays on plan');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('8fbacca7-bbab-5d1a-81c3-dbacb28510f4', 'get', 'once', '3 backup meals', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('8fbacca7-bbab-5d1a-81c3-dbacb28510f4', 'do', 'daily', 'Rotate in a backup meal at least 3x a week', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('bd068057-85c4-5ff1-808b-778955a179bf', 'a35a50c6-f91b-531c-94b6-8ef8c458c322', 9, 'Dessert', 'No more "cheating"');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('bd068057-85c4-5ff1-808b-778955a179bf', 'get', 'once', '3 high-protein desserts from the Proteins, Ice Cream & Superfoods recipes', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('bd068057-85c4-5ff1-808b-778955a179bf', 'do', 'daily', 'Dessert fits her calories', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('dc36278c-fa2e-5d98-8bec-239e8edc8886', 'a35a50c6-f91b-531c-94b6-8ef8c458c322', 10, 'The Last Bite', 'Lean for life');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('dc36278c-fa2e-5d98-8bec-239e8edc8886', 'do', 'daily', 'After the last bite of the day, she looks forward to tomorrow''s meals', 'it''s okay to always want a couple more bites; that''s how you get and stay lean', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('dc36278c-fa2e-5d98-8bec-239e8edc8886', 'get', 'once', '3 more backup meals', '9 go-to meals total', 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('dc36278c-fa2e-5d98-8bec-239e8edc8886', 'hit', 'once', '30 days on target without feeling deprived', 'from check-ins', 2);
insert into public.circles (id, slug, name, kind, method_part, goal, see_a_professional, sort) values ('83c0c2e1-b090-5e79-89ba-3c8186d164da', 'kitchen', 'Kitchen', 'growth', 'metabolism_fix', null, null, 3);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('973ac12a-da9d-540c-aca8-3b1ebe8d4e9e', '83c0c2e1-b090-5e79-89ba-3c8186d164da', 1, 'Set Up', 'Groceries take 10 minutes');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('973ac12a-da9d-540c-aca8-3b1ebe8d4e9e', 'get', 'once', 'Glass Tupperware', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('973ac12a-da9d-540c-aca8-3b1ebe8d4e9e', 'do', 'weekly', 'Order most groceries online', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('48cae10d-5082-5307-96f0-2bffa714603c', '83c0c2e1-b090-5e79-89ba-3c8186d164da', 2, 'Test Week', 'Her go-to meals are proven');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('48cae10d-5082-5307-96f0-2bffa714603c', 'do', 'daily', 'Cook her 3 go-to meals for 7 days straight', 'then 14-day streak', 0);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('fd2ff797-a58a-529a-9fd5-ffd0d67b228f', '83c0c2e1-b090-5e79-89ba-3c8186d164da', 3, 'Ingredient Prep', 'Meals take minutes');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('fd2ff797-a58a-529a-9fd5-ffd0d67b228f', 'do', 'weekly', 'Ingredient prep over meal prep', 'dry ingredients for açaí bowls, seasonings for meat meals, chopped veggies', 0);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('f597e5a7-5a14-567d-b849-a50932b1f0e1', '83c0c2e1-b090-5e79-89ba-3c8186d164da', 4, 'Perfect Them', 'Food replaces some supplements');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('f597e5a7-5a14-567d-b849-a50932b1f0e1', 'do', 'daily', 'Add tiny nutrients to each meal', 'pumpkin seeds, holy basil seeds, hemp hearts, goji berries', 0);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('f95fa759-f6f4-5ba5-86bd-9cf207a075cd', '83c0c2e1-b090-5e79-89ba-3c8186d164da', 5, 'Cost It', 'Eating at home wins on money too');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('f95fa759-f6f4-5ba5-86bd-9cf207a075cd', 'get', 'once', 'The cost of each go-to meal at home, added to her monthly budget', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('f95fa759-f6f4-5ba5-86bd-9cf207a075cd', 'do', 'daily', 'Compare it before eating out', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('f823efce-04f2-51c2-9e96-a1b864945a34', '83c0c2e1-b090-5e79-89ba-3c8186d164da', 6, 'Events', 'Parties don''t derail her');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('f823efce-04f2-51c2-9e96-a1b864945a34', 'do', 'daily', 'Prepare food in advance before every event', '2 events in a row', 0);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('7e81e984-9ce7-533f-b87b-e4032e80744a', '83c0c2e1-b090-5e79-89ba-3c8186d164da', 7, 'Eating Out', 'Restaurants fit the plan');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('7e81e984-9ce7-533f-b87b-e4032e80744a', 'do', 'daily', 'Look up healthy restaurants before going somewhere new', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('7e81e984-9ce7-533f-b87b-e4032e80744a', 'do', 'daily', 'Estimate and log restaurant meals', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('a959a28a-87c5-5091-b95b-0030d274a4df', '83c0c2e1-b090-5e79-89ba-3c8186d164da', 8, 'In a Bind', 'No excuses, anywhere');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('a959a28a-87c5-5091-b95b-0030d274a4df', 'learn', 'once', 'The fastest healthy foods at any grocery store', 'rotisserie chicken, Greek yogurt, pre-cooked potatoes, bagged salad, fruit, jerky, ready-to-drink protein shakes', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('a959a28a-87c5-5091-b95b-0030d274a4df', 'hit', 'once', 'Handles 3 unplanned days on plan', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('99fb68f7-efca-53f6-8616-36b6b2f9b485', '83c0c2e1-b090-5e79-89ba-3c8186d164da', 9, 'Kitchen Elite', 'It runs itself');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('99fb68f7-efca-53f6-8616-36b6b2f9b485', 'hit', 'once', 'All 9 go-to meals on a weekly prep system for 4 weeks', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('99fb68f7-efca-53f6-8616-36b6b2f9b485', 'do', 'daily', 'Her family eats her go-to meals too', 'also Role Model', 1);
insert into public.circles (id, slug, name, kind, method_part, goal, see_a_professional, sort) values ('8735fb3b-9fbc-5f97-a9b7-0c465721b452', 'supplements', 'Supplements', 'growth', 'metabolism_fix', null, null, 4);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('85025f60-48ff-5d76-bacd-929b7d4d0a3b', '8735fb3b-9fbc-5f97-a9b7-0c465721b452', 1, 'Essentials', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('85025f60-48ff-5d76-bacd-929b7d4d0a3b', 'take', 'daily', 'Magnesium glycinate', '300 mg, 2–3 hrs before bed', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('85025f60-48ff-5d76-bacd-929b7d4d0a3b', 'take', 'daily', 'Vitamin D', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('85025f60-48ff-5d76-bacd-929b7d4d0a3b', 'take', 'daily', 'Creatine monohydrate', null, 2);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('85025f60-48ff-5d76-bacd-929b7d4d0a3b', 'take', 'daily', 'Omega-3', 'fish or krill oil', 3);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('85025f60-48ff-5d76-bacd-929b7d4d0a3b', 'take', 'daily', 'Protein powder', 'Mark Bell''s Steak Shake', 4);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('85025f60-48ff-5d76-bacd-929b7d4d0a3b', 'take', 'daily', 'Chlorophyll', null, 5);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('85025f60-48ff-5d76-bacd-929b7d4d0a3b', 'take', 'daily', 'Chromium picolinate', null, 6);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('85025f60-48ff-5d76-bacd-929b7d4d0a3b', 'take', 'daily', 'Boron', null, 7);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('33fd6154-61d6-5a5f-99f6-5924ad6eb33e', '8735fb3b-9fbc-5f97-a9b7-0c465721b452', 2, 'Energy & Focus', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('33fd6154-61d6-5a5f-99f6-5924ad6eb33e', 'take', 'daily', 'L-theanine', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('33fd6154-61d6-5a5f-99f6-5924ad6eb33e', 'take', 'daily', 'Zinc', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('33fd6154-61d6-5a5f-99f6-5924ad6eb33e', 'eat', 'daily', 'Cacao nibs', null, 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('d4271f08-6889-5c66-94c0-723b56ce869c', '8735fb3b-9fbc-5f97-a9b7-0c465721b452', 3, 'Sleep Support', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('d4271f08-6889-5c66-94c0-723b56ce869c', 'eat', 'daily', 'Holy basil seeds', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('d4271f08-6889-5c66-94c0-723b56ce869c', 'eat', 'daily', 'Goji berries', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('d4271f08-6889-5c66-94c0-723b56ce869c', 'eat', 'daily', 'Tart cherry juice', null, 2);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('d4271f08-6889-5c66-94c0-723b56ce869c', 'eat', 'daily', 'Kiwis', null, 3);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('d4271f08-6889-5c66-94c0-723b56ce869c', 'eat', 'daily', '(Kinobody sleep supplement optional)', null, 4);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('a1fc9106-2109-5795-a4e0-ff1949f2a558', '8735fb3b-9fbc-5f97-a9b7-0c465721b452', 4, 'Performance', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('a1fc9106-2109-5795-a4e0-ff1949f2a558', 'do', 'daily', 'Black coffee', 'Fabula', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('a1fc9106-2109-5795-a4e0-ff1949f2a558', 'take', 'daily', 'Natural pre-workout', 'Kino Octane', 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('a1fc9106-2109-5795-a4e0-ff1949f2a558', 'take', 'daily', 'Organic yerba mate', null, 2);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('a1fc9106-2109-5795-a4e0-ff1949f2a558', 'take', 'daily', 'Aminos (optional). All within 300 mg caffeine a day, cutoff 10 hrs before bed', null, 3);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('f7b11f9f-bf25-5f87-89c2-ab84d110fe35', '8735fb3b-9fbc-5f97-a9b7-0c465721b452', 5, 'Mood & Inflammation', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('f7b11f9f-bf25-5f87-89c2-ab84d110fe35', 'take', 'daily', 'Curcumin', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('f7b11f9f-bf25-5f87-89c2-ab84d110fe35', 'take', 'daily', 'Saffron', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('f7b11f9f-bf25-5f87-89c2-ab84d110fe35', 'take', 'daily', 'Ashwagandha', null, 2);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('f7b11f9f-bf25-5f87-89c2-ab84d110fe35', 'take', 'daily', 'Flaxseed oil', null, 3);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('f7b11f9f-bf25-5f87-89c2-ab84d110fe35', 'take', 'daily', 'Glycine', 'optional', 4);
insert into public.circles (id, slug, name, kind, method_part, goal, see_a_professional, sort) values ('2a5ba7cb-5f21-5d26-ba94-e28634514a2d', 'strength', 'Strength', 'growth', 'proper_strength_training', null, null, 5);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('d0ed56a1-4d64-566c-82c3-a27d36ef3dea', '2a5ba7cb-5f21-5d26-ba94-e28634514a2d', 1, 'First Sessions', 'Training becomes a habit');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('d0ed56a1-4d64-566c-82c3-a27d36ef3dea', 'do', 'weekly', '1x full body', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('d0ed56a1-4d64-566c-82c3-a27d36ef3dea', 'get', 'once', 'A training notebook; logs weight and rest with pen and paper', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('bd8190e1-407f-5e18-baad-7ebe06ec48fd', '2a5ba7cb-5f21-5d26-ba94-e28634514a2d', 2, 'Twice a Week', 'Strength climbs every week');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('bd8190e1-407f-5e18-baad-7ebe06ec48fd', 'do', 'weekly', '2x full body', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('bd8190e1-407f-5e18-baad-7ebe06ec48fd', 'do', 'daily', 'Beats last week''s weight or reps on one lift per session', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('98abc256-5528-5ee5-948f-a3096241f32e', '2a5ba7cb-5f21-5d26-ba94-e28634514a2d', 3, 'Three a Week', 'The full Proper Strength Training split');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('98abc256-5528-5ee5-948f-a3096241f32e', 'do', 'weekly', '3x a week, upper / lower / upper, 30 minutes each', null, 0);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('f6b4f188-4c0f-5480-9076-0202d0534da4', '2a5ba7cb-5f21-5d26-ba94-e28634514a2d', 4, 'Core', 'A stronger midsection');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('f6b4f188-4c0f-5480-9076-0202d0534da4', 'do', 'weekly', 'Decline crunches', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('f6b4f188-4c0f-5480-9076-0202d0534da4', 'hit', 'once', '20-second hollow hang on the bar', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('2613bac6-a0b9-542d-b26d-1e2191a2b51a', '2a5ba7cb-5f21-5d26-ba94-e28634514a2d', 5, 'First Pushup', 'Her first full pushup');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('2613bac6-a0b9-542d-b26d-1e2191a2b51a', 'do', 'weekly', 'Incline pushups → knee pushups → slow negatives', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('2613bac6-a0b9-542d-b26d-1e2191a2b51a', 'hit', 'once', '1 full pushup', 'video', 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('5f26dfd0-9c40-52cd-b034-eae3f537ffad', '2a5ba7cb-5f21-5d26-ba94-e28634514a2d', 6, 'Pull-Up Foundations', 'Strong grip and shoulders');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('5f26dfd0-9c40-52cd-b034-eae3f537ffad', 'hit', 'once', '45-second active hang', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('5f26dfd0-9c40-52cd-b034-eae3f537ffad', 'hit', 'once', '10 scapula pulls', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('5f26dfd0-9c40-52cd-b034-eae3f537ffad', 'hit', 'once', '3 × 10 Australian pull-ups', 'lowering the bar as she gets stronger', 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('f785cc2e-df8a-5834-8e05-a1b5c0a5a219', '2a5ba7cb-5f21-5d26-ba94-e28634514a2d', 7, 'Pull-Up Builders', 'Ready for the real thing');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('f785cc2e-df8a-5834-8e05-a1b5c0a5a219', 'hit', 'once', '5 × 5-second negative pull-ups', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('f785cc2e-df8a-5834-8e05-a1b5c0a5a219', 'hit', 'once', '3 × 8 band-assisted pull-ups', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('f785cc2e-df8a-5834-8e05-a1b5c0a5a219', 'do', 'daily', '"grease the groove": a hang or scapula pull every time she passes her bar', null, 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('ee40130c-adf2-5ed8-9554-8a82f720863d', '2a5ba7cb-5f21-5d26-ba94-e28634514a2d', 8, 'First Pull-Up', 'The moment she''s been training for');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('ee40130c-adf2-5ed8-9554-8a82f720863d', 'hit', 'once', 'First chin-up', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('ee40130c-adf2-5ed8-9554-8a82f720863d', 'hit', 'once', 'First full pull-up', 'video', 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('784011c1-3449-5cbb-bc12-09a101c67173', '2a5ba7cb-5f21-5d26-ba94-e28634514a2d', 9, 'Strength Standards', 'Stronger than in her twenties');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('784011c1-3449-5cbb-bc12-09a101c67173', 'hit', 'once', '10 pushups', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('784011c1-3449-5cbb-bc12-09a101c67173', 'hit', 'once', '3 pull-ups', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('784011c1-3449-5cbb-bc12-09a101c67173', 'hit', 'once', 'L-sit on rings for 10 seconds', null, 2);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('784011c1-3449-5cbb-bc12-09a101c67173', 'hit', 'once', 'Deadlift her bodyweight for 5 reps', null, 3);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('6693361e-3be3-5571-b5c7-e0145ee419c7', '2a5ba7cb-5f21-5d26-ba94-e28634514a2d', 10, 'Strength Elite', 'Driven');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('6693361e-3be3-5571-b5c7-e0145ee419c7', 'hit', 'once', '5 pull-ups', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('6693361e-3be3-5571-b5c7-e0145ee419c7', 'hit', 'once', 'Deadlift 1.5x bodyweight', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('6693361e-3be3-5571-b5c7-e0145ee419c7', 'hit', 'once', '20-second L-sit on rings', null, 2);
insert into public.circles (id, slug, name, kind, method_part, goal, see_a_professional, sort) values ('f4743a3a-7f86-57f0-9fbc-f6426bec96bc', 'cardio', 'Cardio', 'growth', 'proper_strength_training', null, null, 6);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('e5f0e0d4-91da-56b3-8898-44d5b0ec8633', 'f4743a3a-7f86-57f0-9fbc-f6426bec96bc', 1, '6,000 Steps', 'Moving every day');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('e5f0e0d4-91da-56b3-8898-44d5b0ec8633', 'do', 'daily', '6,000 steps daily', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('e5f0e0d4-91da-56b3-8898-44d5b0ec8633', 'do', 'daily', '2,000 of them within 60 minutes of waking', 'also Circadian Reset', 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('8c004e26-422d-53b1-bc5e-5f790a0726dc', 'f4743a3a-7f86-57f0-9fbc-f6426bec96bc', 2, '8,000 Steps', 'Better blood sugar after meals');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('8c004e26-422d-53b1-bc5e-5f790a0726dc', 'do', 'daily', '8,000 steps daily', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('8c004e26-422d-53b1-bc5e-5f790a0726dc', 'do', 'daily', '10-minute walk after every meal', 'also Circadian Reset', 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('7c980c49-98a3-5240-98aa-c70f99b138af', 'f4743a3a-7f86-57f0-9fbc-f6426bec96bc', 3, '9,000 Steps + Rope', 'Hard cardio begins');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('7c980c49-98a3-5240-98aa-c70f99b138af', 'do', 'daily', '9,000 steps daily', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('7c980c49-98a3-5240-98aa-c70f99b138af', 'do', 'weekly', '300 jump-rope jumps', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('1ea6afde-aef0-54f8-b3ac-5dc3af12d61a', 'f4743a3a-7f86-57f0-9fbc-f6426bec96bc', 4, '10,000 Steps', 'The daily standard');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('1ea6afde-aef0-54f8-b3ac-5dc3af12d61a', 'do', 'daily', '10,000 steps daily', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('1ea6afde-aef0-54f8-b3ac-5dc3af12d61a', 'do', 'weekly', '1,000 jump-rope jumps', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('b3e6e67a-3a75-58ad-85dd-045938ea4f79', 'f4743a3a-7f86-57f0-9fbc-f6426bec96bc', 5, 'Sprints', 'Better hormones and mood');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('b3e6e67a-3a75-58ad-85dd-045938ea4f79', 'do', 'weekly', '6 hill sprints, first at 50%, then 75%, then all-out', 'or bike sprints) (also Circadian Reset', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('b3e6e67a-3a75-58ad-85dd-045938ea4f79', 'do', 'daily', 'Keeps 10,000 steps and 1,000 weekly jumps going', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('b81b378e-0e1a-5c29-bdb9-fdeadbc5c9fe', 'f4743a3a-7f86-57f0-9fbc-f6426bec96bc', 6, 'Sleds', 'Hard work without wrecking her joints');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('b81b378e-0e1a-5c29-bdb9-fdeadbc5c9fe', 'do', 'weekly', '10 sled pushes back and forth, on one day', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('b81b378e-0e1a-5c29-bdb9-fdeadbc5c9fe', 'do', 'daily', 'No medium cardio', 'no long jogs or spin classes in her week', 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('36a4ac2c-e39b-5760-8408-0530a452dfb4', 'f4743a3a-7f86-57f0-9fbc-f6426bec96bc', 7, 'Triple Cardio', 'All three energy systems');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('36a4ac2c-e39b-5760-8408-0530a452dfb4', 'hit', 'once', '8 weeks in a row of 10,000 daily steps, 1,000 weekly jumps, weekly sprints and weekly sleds', null, 0);
insert into public.circles (id, slug, name, kind, method_part, goal, see_a_professional, sort) values ('36eb86ed-1964-59c4-adf8-394fae367521', 'mobility', 'Mobility & Desk Body', 'growth', 'proper_strength_training', null, null, 7);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('5fecadba-aede-5c50-8ef5-b51e654b1d78', '36eb86ed-1964-59c4-adf8-394fae367521', 1, 'Desk Reset', 'Less stiffness by 3 PM');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('5fecadba-aede-5c50-8ef5-b51e654b1d78', 'do', 'daily', 'Stand up every 45 minutes', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('5fecadba-aede-5c50-8ef5-b51e654b1d78', 'do', 'daily', 'Daily calf stretch', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('0d24b7e8-3eef-5e1b-92cc-d82c1dcdbd1f', '36eb86ed-1964-59c4-adf8-394fae367521', 2, 'Squat Hold', 'Hips and ankles open up');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('0d24b7e8-3eef-5e1b-92cc-d82c1dcdbd1f', 'do', 'daily', 'Daily deep squat hold, working up to 2 minutes', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('0d24b7e8-3eef-5e1b-92cc-d82c1dcdbd1f', 'do', 'daily', 'Deep lunges with an overhead reach, 5 steps each side, a few times a day', 'H&H 44', 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('fff7e180-252c-5790-9847-6c79c8cc4ed3', '36eb86ed-1964-59c4-adf8-394fae367521', 3, 'Morning Mobility', 'Wakes up loose');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('fff7e180-252c-5790-9847-6c79c8cc4ed3', 'do', 'daily', '5-minute bedroom yoga', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('fff7e180-252c-5790-9847-6c79c8cc4ed3', 'do', 'daily', 'Rumble roller', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('cd9e4371-ab3c-5485-86da-ce44040720fc', '36eb86ed-1964-59c4-adf8-394fae367521', 4, 'Standing Desk', 'Less sitting, more burning');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('cd9e4371-ab3c-5485-86da-ce44040720fc', 'get', 'once', 'Standing desk or walking pad', 'also Healthy Home', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('cd9e4371-ab3c-5485-86da-ce44040720fc', 'do', 'daily', '30+ minutes standing or walking per workday', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('8baca5a6-2695-5deb-ac19-2827c96458ce', '36eb86ed-1964-59c4-adf8-394fae367521', 5, 'Hang & Hips', 'Shoulders and hips feel younger');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('8baca5a6-2695-5deb-ac19-2827c96458ce', 'do', 'daily', 'Daily dead hang, 1 minute building toward 5', 'H&H 36', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('8baca5a6-2695-5deb-ac19-2827c96458ce', 'do', 'daily', 'Daily hip opener', 'couch stretch or 90/90', 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('e1e88f03-82f7-5255-b246-0eecf8145145', '36eb86ed-1964-59c4-adf8-394fae367521', 6, 'Knees Over Toes', 'Bulletproof knees and feet');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('e1e88f03-82f7-5255-b246-0eecf8145145', 'do', 'weekly', '60-second backward walk', 'incline or sled', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('e1e88f03-82f7-5255-b246-0eecf8145145', 'do', 'weekly', 'Tibialis raises 25 reps', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('e1e88f03-82f7-5255-b246-0eecf8145145', 'do', 'weekly', 'Straight-leg and knee-over-toe calf raises 25 reps', null, 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('9b2cc0be-8df6-51f1-b41c-464e4ffcbdd3', '36eb86ed-1964-59c4-adf8-394fae367521', 7, 'Weighted Squat Hold', 'Mobility with strength');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('9b2cc0be-8df6-51f1-b41c-464e4ffcbdd3', 'hit', 'once', '2-minute squat hold with 25% of her bodyweight', null, 0);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('4c1fff10-03fb-5c8f-913c-170eb5329a59', '36eb86ed-1964-59c4-adf8-394fae367521', 8, 'Shoulders & Spine', 'Supple like a leopard');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('4c1fff10-03fb-5c8f-913c-170eb5329a59', 'do', 'daily', 'Dislocations with every upper-body workout', 'H&H 32', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('4c1fff10-03fb-5c8f-913c-170eb5329a59', 'do', 'daily', '10 cat-camels in bed every night, plus the morning in-bed routine: leg kicks, hip thrusts, rollovers, scissor kicks (H&H 48)', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('516b5c7e-e528-525b-bfe2-a686a6b5ccf0', '36eb86ed-1964-59c4-adf8-394fae367521', 9, 'Hips & Neck', 'Turns her head and hips freely');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('516b5c7e-e528-525b-bfe2-a686a6b5ccf0', 'do', 'weekly', 'Webster inner thigh roll + 90/90 rear-foot raises × 5 before leg day', 'H&H 40', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('516b5c7e-e528-525b-bfe2-a686a6b5ccf0', 'do', 'weekly', 'Neck routine: around the worlds, "Daft Punks," "exorcists," side-to-sides × 10', 'H&H 52', 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('8ded8f0b-3ecb-5cb5-bb51-0cf395c8b6e3', '36eb86ed-1964-59c4-adf8-394fae367521', 10, 'Mobility Elite', 'Moves like an athlete');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('8ded8f0b-3ecb-5cb5-bb51-0cf395c8b6e3', 'hit', 'once', '5-minute dead hang', 'accumulated', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('8ded8f0b-3ecb-5cb5-bb51-0cf395c8b6e3', 'hit', 'once', 'Touches her toes with straight legs', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('8ded8f0b-3ecb-5cb5-bb51-0cf395c8b6e3', 'hit', 'once', 'Flat-heeled deep squat for 2 minutes', null, 2);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('8ded8f0b-3ecb-5cb5-bb51-0cf395c8b6e3', 'hit', 'once', 'Full overhead reach against a wall', null, 3);
insert into public.circles (id, slug, name, kind, method_part, goal, see_a_professional, sort) values ('f441abe2-ac9b-5386-bc31-7896c90631f4', 'mindset', 'Mindset', 'growth', 'lifestyle', null, null, 8);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('66730a27-e1d3-5318-a6d8-f041488fd487', 'f441abe2-ac9b-5386-bc31-7896c90631f4', 1, 'Accountability', 'She sees her progress honestly');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('66730a27-e1d3-5318-a6d8-f041488fd487', 'do', 'daily', 'Weigh in daily until she hits her goal', 'also Food Philosophy', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('66730a27-e1d3-5318-a6d8-f041488fd487', 'do', 'weekly', 'Check-in on time', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('80440c6e-8cc4-55b7-8ef8-9ef6016fa4be', 'f441abe2-ac9b-5386-bc31-7896c90631f4', 2, 'Gratitude', 'A calmer start to the day');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('80440c6e-8cc4-55b7-8ef8-9ef6016fa4be', 'do', 'daily', 'Write 1 thing she''s grateful for each morning', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('80440c6e-8cc4-55b7-8ef8-9ef6016fa4be', 'do', 'daily', 'A morning appreciation text to someone', 'H&H 31', 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('5d22d33d-d58c-5755-90c3-1732a81cb66b', 'f441abe2-ac9b-5386-bc31-7896c90631f4', 3, 'Plan Tomorrow', 'Mornings without chaos');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('5d22d33d-d58c-5755-90c3-1732a81cb66b', 'do', 'daily', 'Write tomorrow''s schedule before bed', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('5d22d33d-d58c-5755-90c3-1732a81cb66b', 'learn', 'once', 'The Eisenhower Matrix', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('5d22d33d-d58c-5755-90c3-1732a81cb66b', 'do', 'daily', 'One non-negotiable in each of 4 areas: body', '10,000 steps), food (hit calories), love (appreciation for the people around her), career/finances (SBW 9', 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('2c11cbc6-41f0-56bb-b16f-46642c36a97d', 'f441abe2-ac9b-5386-bc31-7896c90631f4', 4, 'The Matrix', 'Workouts stop getting bumped');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('2c11cbc6-41f0-56bb-b16f-46642c36a97d', 'do', 'daily', 'Sort her day with the Eisenhower Matrix', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('2c11cbc6-41f0-56bb-b16f-46642c36a97d', 'do', 'daily', 'Workouts scheduled as non-negotiable', '"important, not urgent"', 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('cf5c3e07-38ea-5aa8-b658-5c2a8fb3d2f7', 'f441abe2-ac9b-5386-bc31-7896c90631f4', 5, 'The 3-to-1 Rule', 'Setbacks stop spiraling');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('cf5c3e07-38ea-5aa8-b658-5c2a8fb3d2f7', 'do', 'daily', 'When something bad happens, write down 3 good things for the 1 bad', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('cf5c3e07-38ea-5aa8-b658-5c2a8fb3d2f7', 'learn', 'once', 'Learning from adversity', 'SMF 11', 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('cf5c3e07-38ea-5aa8-b658-5c2a8fb3d2f7', 'learn', 'once', 'The emotional cycle of change and the "valley of despair"', 'SBW 10', 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('d76f4d67-3392-5973-8784-b17786d8bca2', 'f441abe2-ac9b-5386-bc31-7896c90631f4', 6, 'Celebrate the Execution', 'Motivation that doesn''t depend on the scale');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('d76f4d67-3392-5973-8784-b17786d8bca2', 'do', 'daily', 'Each night, note one habit she executed', '"celebrate the execution, the results will come later"', 0);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('357d7314-a692-55ba-bae0-90075f0b17ae', 'f441abe2-ac9b-5386-bc31-7896c90631f4', 7, 'Reason Why', 'She knows why she''s doing this');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('357d7314-a692-55ba-bae0-90075f0b17ae', 'get', 'once', 'Her written reason why', 'revisited at Week 11, H&H 11', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('357d7314-a692-55ba-bae0-90075f0b17ae', 'do', 'daily', '2-minute daily visualization', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('357d7314-a692-55ba-bae0-90075f0b17ae', 'learn', 'once', 'Watch the movie *Violet*', 'boundaries and thinking for herself, H&H 10', 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('496b57bb-599c-5d22-b505-c1eb6f04da39', 'f441abe2-ac9b-5386-bc31-7896c90631f4', 8, 'Stress Reset', 'Calm under pressure');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('496b57bb-599c-5d22-b505-c1eb6f04da39', 'do', 'daily', '2 physiological sighs whenever stress spikes', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('496b57bb-599c-5d22-b505-c1eb6f04da39', 'do', 'daily', '60 phone-free minutes a day', 'H&H 23', 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('496b57bb-599c-5d22-b505-c1eb6f04da39', 'do', 'daily', 'Ocean swim or float tank every week or two', 'H&H 28', 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('cbce75c9-996c-572a-937e-c4a672e259ae', 'f441abe2-ac9b-5386-bc31-7896c90631f4', 9, 'Vision Board', 'She sees where she''s going');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('cbce75c9-996c-572a-937e-c4a672e259ae', 'get', 'once', 'A physical vision board: 3–5 pictures each for relationships, career and finances, health and fitness, with her in the middle (H&H 39)', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('cbce75c9-996c-572a-937e-c4a672e259ae', 'do', 'daily', 'Looks at it daily', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('993edf8d-b378-5569-b5ac-244b673830e6', 'f441abe2-ac9b-5386-bc31-7896c90631f4', 10, 'Abundance', 'Gives more, stresses less');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('993edf8d-b378-5569-b5ac-244b673830e6', 'learn', 'once', '*The Go-Giver*', 'H&H 37', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('993edf8d-b378-5569-b5ac-244b673830e6', 'do', 'weekly', 'Pay it forward, one kind act without expecting anything back', 'H&H 47', 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('ddaee79f-82b2-58ca-9789-76e7f62d642b', 'f441abe2-ac9b-5386-bc31-7896c90631f4', 11, 'Dopamine Detox', 'Focus comes back');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('ddaee79f-82b2-58ca-9789-76e7f62d642b', 'do', 'daily', 'Social media and TV only if it improves her mind', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('ddaee79f-82b2-58ca-9789-76e7f62d642b', 'do', 'daily', 'No little snacks at home', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('ddaee79f-82b2-58ca-9789-76e7f62d642b', 'do', 'weekly', 'One slow, hands-on task that puts her in flow', 'garage, washing the car by hand) (H&H 51', 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('412691b1-03e8-547e-b89c-b246b4bd2922', 'f441abe2-ac9b-5386-bc31-7896c90631f4', 12, 'Cold Showers', 'Proves to herself daily she can do hard things');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('412691b1-03e8-547e-b89c-b246b4bd2922', 'do', 'daily', 'End every shower cold, building up step by step', 'feet → legs → stomach → chest and face → armpits → back) (H&H 43', 0);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('232e3630-cde0-51f1-94cf-000eafeea89b', 'f441abe2-ac9b-5386-bc31-7896c90631f4', 13, 'Reading I', 'A stronger mind');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('232e3630-cde0-51f1-94cf-000eafeea89b', 'learn', 'once', '*Think and Grow Rich*', 'H&H 13', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('232e3630-cde0-51f1-94cf-000eafeea89b', 'learn', 'once', '*How to Win Friends and Influence People*', 'H&H 17', 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('232e3630-cde0-51f1-94cf-000eafeea89b', 'learn', 'once', '*Who Moved My Cheese?*', 'H&H 21', 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('0ea21b7d-a0d9-55f5-a88c-9e14551e9729', 'f441abe2-ac9b-5386-bc31-7896c90631f4', 14, 'Reading II', 'High performance');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('0ea21b7d-a0d9-55f5-a88c-9e14551e9729', 'learn', 'once', '*Relentless* by Tim Grover', 'H&H 25', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('0ea21b7d-a0d9-55f5-a88c-9e14551e9729', 'learn', 'once', '*The Perfect Week Formula* by Craig Valentine', 'H&H 29', 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('0ea21b7d-a0d9-55f5-a88c-9e14551e9729', 'learn', 'once', '*The Almanack of Naval Ravikant*', 'H&H 33', 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('d99cb846-08df-55b8-8b84-45ca49d75e7e', 'f441abe2-ac9b-5386-bc31-7896c90631f4', 15, 'Reading III', 'Mental toughness');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('d99cb846-08df-55b8-8b84-45ca49d75e7e', 'learn', 'once', '*Don''t Eat the Marshmallow Yet*', 'H&H 41', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('d99cb846-08df-55b8-8b84-45ca49d75e7e', 'learn', 'once', '*Thou Shall Prosper*', 'H&H 45', 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('d99cb846-08df-55b8-8b84-45ca49d75e7e', 'learn', 'once', '*177 Mental Toughness Secrets of the World Class*', 'H&H 49', 2);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('d99cb846-08df-55b8-8b84-45ca49d75e7e', 'learn', 'once', '*What to Say When You Talk to Yourself* by Shad Helmstetter', null, 3);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('176fe893-ed15-57ea-a1bb-b4afbb8073db', 'f441abe2-ac9b-5386-bc31-7896c90631f4', 16, 'Identity (elite)', '"This is who I am"');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('176fe893-ed15-57ea-a1bb-b4afbb8073db', 'get', 'once', 'Her identity statement', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('176fe893-ed15-57ea-a1bb-b4afbb8073db', 'hit', 'once', '12 weeks of on-time check-ins in a row', null, 1);
insert into public.circles (id, slug, name, kind, method_part, goal, see_a_professional, sort) values ('2589ae21-250a-526e-b7ad-d3d7c5d86b26', 'healthy-home', 'Healthy Home', 'growth', 'lifestyle', null, null, 9);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('df0d20c3-dfd4-5153-a5d1-7653f88535fa', '2589ae21-250a-526e-b7ad-d3d7c5d86b26', 1, 'Bedroom', 'Better sleep from day one');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('df0d20c3-dfd4-5153-a5d1-7653f88535fa', 'get', 'once', 'Blackout shades', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('df0d20c3-dfd4-5153-a5d1-7653f88535fa', 'get', 'once', 'TV out, real alarm clock', 'both also Circadian Reset', 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('df0d20c3-dfd4-5153-a5d1-7653f88535fa', 'do', 'daily', 'Phone charges in another room', null, 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('a727ea99-a8d7-5e99-80c8-0553f333ec1a', '2589ae21-250a-526e-b7ad-d3d7c5d86b26', 2, 'Clean Air', 'Fewer headaches, easier breathing');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('a727ea99-a8d7-5e99-80c8-0553f333ec1a', 'get', 'once', 'Remove plug-in air fresheners', 'beeswax candles or an open window instead', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('a727ea99-a8d7-5e99-80c8-0553f333ec1a', 'get', 'once', 'HEPA air purifier in the bedroom', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('a727ea99-a8d7-5e99-80c8-0553f333ec1a', 'do', 'daily', 'Open the windows 10 minutes daily', null, 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('221faf0d-5836-51c0-aea1-3eef5c26f7d4', '2589ae21-250a-526e-b7ad-d3d7c5d86b26', 3, 'Laundry & Mold', 'Fewer hidden toxins');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('221faf0d-5836-51c0-aea1-3eef5c26f7d4', 'get', 'once', 'Fragrance-free detergent and wool dryer balls', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('221faf0d-5836-51c0-aea1-3eef5c26f7d4', 'get', 'once', 'Check for mold; hygrometer', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('221faf0d-5836-51c0-aea1-3eef5c26f7d4', 'do', 'daily', 'Keep humidity under 50%', null, 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('bae656a5-84a3-5d1b-b2fb-ffd976a4573c', '2589ae21-250a-526e-b7ad-d3d7c5d86b26', 4, 'Clean Kitchen', 'Safer cooking');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('bae656a5-84a3-5d1b-b2fb-ffd976a4573c', 'get', 'once', 'Replace nonstick with stainless steel, cast iron or ceramic', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('bae656a5-84a3-5d1b-b2fb-ffd976a4573c', 'get', 'once', 'Replace plastic with stainless steel, wooden cutting boards, glass Tupperware', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('bae656a5-84a3-5d1b-b2fb-ffd976a4573c', 'do', 'daily', 'Never heat food in plastic', null, 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('4fcc2d08-3206-56b8-8df5-37adc6b4fcda', '2589ae21-250a-526e-b7ad-d3d7c5d86b26', 5, 'Clean Water', 'Better water, every day');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('4fcc2d08-3206-56b8-8df5-37adc6b4fcda', 'get', 'once', 'Shower filter', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('4fcc2d08-3206-56b8-8df5-37adc6b4fcda', 'get', 'once', 'Reverse osmosis filter with remineralizer', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('4fcc2d08-3206-56b8-8df5-37adc6b4fcda', 'do', 'daily', 'Drink filtered water only', null, 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('303f4ced-9126-5795-8fe8-3bcd28eef39b', '2589ae21-250a-526e-b7ad-d3d7c5d86b26', 6, 'Calm Space', 'Lower cortisol at home');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('303f4ced-9126-5795-8fe8-3bcd28eef39b', 'do', 'daily', 'Keep the surfaces where she decompresses clear', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('303f4ced-9126-5795-8fe8-3bcd28eef39b', 'get', 'once', 'Standing desk or walking pad', 'also Mobility', 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('2f26b215-f236-59ca-9ec0-065570dc3db7', '2589ae21-250a-526e-b7ad-d3d7c5d86b26', 7, 'Trigger-Free', 'Willpower stops being needed');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('2f26b215-f236-59ca-9ec0-065570dc3db7', 'do', 'daily', 'Trigger foods out of the house', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('2f26b215-f236-59ca-9ec0-065570dc3db7', 'do', 'daily', 'Healthy foods visible and ready to grab', null, 1);
insert into public.circles (id, slug, name, kind, method_part, goal, see_a_professional, sort) values ('bc71b1c4-ca7e-5337-b563-ce2c3e218a57', 'role-model', 'Role Model', 'growth', 'lifestyle', null, null, 10);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('f8cfb55d-fccf-53a0-8a96-0e133518ecbf', 'bc71b1c4-ca7e-5337-b563-ce2c3e218a57', 1, 'Me Time', 'She puts herself first');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('f8cfb55d-fccf-53a0-8a96-0e133518ecbf', 'do', 'daily', 'Protect 30 minutes a day for herself', 'workouts count', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('f8cfb55d-fccf-53a0-8a96-0e133518ecbf', 'get', 'once', 'It''s blocked in her calendar', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('609ace7d-dda0-59c9-bc4c-e414f8b585f3', 'bc71b1c4-ca7e-5337-b563-ce2c3e218a57', 2, 'Family Walks', 'Health becomes family time');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('609ace7d-dda0-59c9-bc4c-e414f8b585f3', 'do', 'weekly', '2+ walks with her family or partner', null, 0);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('4c5fb2b6-f324-5a5f-84b7-71d02ebde4ce', 'bc71b1c4-ca7e-5337-b563-ce2c3e218a57', 3, 'Cook Together', 'Her kids learn real food');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('4c5fb2b6-f324-5a5f-84b7-71d02ebde4ce', 'do', 'weekly', 'Cook one healthy meal with her kids or partner', null, 0);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('cc17e484-efa7-5db4-9f7c-fdac34289ade', 'bc71b1c4-ca7e-5337-b563-ce2c3e218a57', 4, 'Family Swaps', 'The whole house eats better');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('cc17e484-efa7-5db4-9f7c-fdac34289ade', 'do', 'daily', '3 healthier swaps for the whole family', 'snacks, drinks, desserts', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('cc17e484-efa7-5db4-9f7c-fdac34289ade', 'do', 'weekly', 'The family eats one of her go-to meals', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('baf81006-d332-5a85-b0ba-bfb95c308227', 'bc71b1c4-ca7e-5337-b563-ce2c3e218a57', 5, 'Move Together', 'They see her strength');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('baf81006-d332-5a85-b0ba-bfb95c308227', 'hit', 'once', 'Her partner or a family member joins a workout', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('baf81006-d332-5a85-b0ba-bfb95c308227', 'do', 'weekly', 'An active family outing', 'hike, bike ride, park', 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('f47317c7-abd8-528f-bbf0-099b8a804960', 'bc71b1c4-ca7e-5337-b563-ce2c3e218a57', 6, 'Role Model Elite', 'She''s the example');
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('f47317c7-abd8-528f-bbf0-099b8a804960', 'hit', 'once', 'Her kids or partner choose a healthy option on their own', 'shared in a check-in', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('f47317c7-abd8-528f-bbf0-099b8a804960', 'hit', 'once', 'She shares her story in the community to help a new client', null, 1);
insert into public.circles (id, slug, name, kind, method_part, goal, see_a_professional, sort) values ('aa0b9dfd-344c-5f94-b797-c99fcf151fc8', 'travel', 'Travel', 'fixit_event', null, null, null, 11);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('959bd955-71ba-5bef-bd89-5a23f8f14cb8', 'aa0b9dfd-344c-5f94-b797-c99fcf151fc8', 1, 'Before the Trip', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('959bd955-71ba-5bef-bd89-5a23f8f14cb8', 'do', 'daily', 'A full-body strength session the day before she leaves', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('959bd955-71ba-5bef-bd89-5a23f8f14cb8', 'get', 'once', 'Packed protein', 'protein powder sachets and shaker, jerky', 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('959bd955-71ba-5bef-bd89-5a23f8f14cb8', 'get', 'once', 'Healthy restaurants and the hotel gym looked up', null, 2);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('959bd955-71ba-5bef-bd89-5a23f8f14cb8', 'get', 'once', 'The Travel Workout Guide downloaded', null, 3);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('9ae6f769-94f0-56e7-971a-9ba4c5b0766a', 'aa0b9dfd-344c-5f94-b797-c99fcf151fc8', 2, 'On the Road', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('9ae6f769-94f0-56e7-971a-9ba4c5b0766a', 'do', 'daily', 'The 3-Hour Window on local time', 'morning light is the fastest jet-lag fix', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('9ae6f769-94f0-56e7-971a-9ba4c5b0766a', 'do', 'daily', '40 g+ protein each meal, protein first', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('9ae6f769-94f0-56e7-971a-9ba4c5b0766a', 'do', 'daily', '10,000 steps', null, 2);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('9ae6f769-94f0-56e7-971a-9ba4c5b0766a', 'do', 'daily', 'A 30-minute Travel Workout Guide session every 2–3 days', null, 3);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('30dc47ce-b092-5a76-b9e3-b4b2b1f28542', 'aa0b9dfd-344c-5f94-b797-c99fcf151fc8', 3, 'Back Home', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('30dc47ce-b092-5a76-b9e3-b4b2b1f28542', 'do', 'daily', 'A reset session the day she''s back', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('30dc47ce-b092-5a76-b9e3-b4b2b1f28542', 'do', 'daily', 'Straight back to her normal plan the next morning', 'no punishment', 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('30dc47ce-b092-5a76-b9e3-b4b2b1f28542', 'hit', 'once', 'Back to her pre-trip weight within 7 days', 'water retention clears in about 48 hours', 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('96cc9049-ebe5-5da7-8c1e-b22a1045328d', 'aa0b9dfd-344c-5f94-b797-c99fcf151fc8', 4, 'Road Warrior (frequent travelers)', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('96cc9049-ebe5-5da7-8c1e-b22a1045328d', 'hit', 'once', '3 trips in a row back at her pre-trip weight within a week', null, 0);
insert into public.circles (id, slug, name, kind, method_part, goal, see_a_professional, sort) values ('5446eea0-c377-506e-ae0a-8fc6b35bf47d', 'holidays-events', 'Holidays & Events', 'fixit_event', null, null, null, 12);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('26d2a3b9-9b56-5c3a-82a2-4bc4ad38c98a', '5446eea0-c377-506e-ae0a-8fc6b35bf47d', 1, 'Before', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('26d2a3b9-9b56-5c3a-82a2-4bc4ad38c98a', 'do', 'daily', 'An anchor workout the morning of the event', 'Weekend Warrior Protocol', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('26d2a3b9-9b56-5c3a-82a2-4bc4ad38c98a', 'do', 'daily', 'A 40 g protein breakfast', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('26d2a3b9-9b56-5c3a-82a2-4bc4ad38c98a', 'get', 'once', 'Her drink limit decided in advance', null, 2);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('26d2a3b9-9b56-5c3a-82a2-4bc4ad38c98a', 'get', 'once', 'A dish she can eat brought along', 'Kitchen Ring 6', 3);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('e5a995fd-a08d-5bca-8620-6cf4b95f7949', '5446eea0-c377-506e-ae0a-8fc6b35bf47d', 2, 'The Day', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('e5a995fd-a08d-5bca-8620-6cf4b95f7949', 'do', 'daily', 'Eat sitting down, one plate, protein first', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('e5a995fd-a08d-5bca-8620-6cf4b95f7949', 'do', 'daily', 'A 10-minute walk after the meal', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('e5a995fd-a08d-5bca-8620-6cf4b95f7949', 'do', 'daily', 'Estimate and log it', null, 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('f52ffb77-5024-56ae-9f76-81aea3f42ad2', '5446eea0-c377-506e-ae0a-8fc6b35bf47d', 3, 'The Day After', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('f52ffb77-5024-56ae-9f76-81aea3f42ad2', 'do', 'daily', 'Straight back to her normal plan, no punishment and no skipped meals', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('f52ffb77-5024-56ae-9f76-81aea3f42ad2', 'do', 'daily', 'Weigh in and remember it''s mostly water', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('4ba448c2-ba16-5504-87ab-45e28727e706', '5446eea0-c377-506e-ae0a-8fc6b35bf47d', 4, 'The Season (Thanksgiving to New Year)', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('4ba448c2-ba16-5504-87ab-45e28727e706', 'do', 'weekly', '3 workouts a week all through December', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('4ba448c2-ba16-5504-87ab-45e28727e706', 'hit', 'once', 'Through the holiday season within 2 lbs', null, 1);
insert into public.circles (id, slug, name, kind, method_part, goal, see_a_professional, sort) values ('ed01e129-72c5-5afc-a6e9-cc01d1bdc6aa', 'menopause', 'Menopause Symptoms', 'fixit_ongoing', null, null, 'any bleeding after menopause (12+ months without a period), very heavy or irregular bleeding, severe mood changes or depression, symptoms that disrupt daily life, any new or unusual symptom. Also suggest she asks about a bone density scan. Hands off to: Strength and Circadian Reset.', 13);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('460a9623-caed-5a2e-940b-a74d7eaadf30', 'ed01e129-72c5-5afc-a6e9-cc01d1bdc6aa', 1, 'Track It', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('460a9623-caed-5a2e-940b-a74d7eaadf30', 'do', 'daily', 'Log her symptoms daily', 'hot flashes, night sweats, sleep, mood, cycle', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('460a9623-caed-5a2e-940b-a74d7eaadf30', 'learn', 'once', 'Perimenopause vs. menopause and what''s changing', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('460a9623-caed-5a2e-940b-a74d7eaadf30', 'get', 'once', 'A doctor''s appointment booked if symptoms disrupt her daily life', 'to discuss HRT and other options', 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('a6fdad2b-eb15-5d14-8915-4b39e3209082', 'ed01e129-72c5-5afc-a6e9-cc01d1bdc6aa', 2, 'Cool Nights', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('a6fdad2b-eb15-5d14-8915-4b39e3209082', 'do', 'daily', 'Bedroom 65–68°F, breathable bedding', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('a6fdad2b-eb15-5d14-8915-4b39e3209082', 'do', 'daily', 'Limit alcohol', 'a top hot-flash trigger', 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('a6fdad2b-eb15-5d14-8915-4b39e3209082', 'do', 'daily', 'Find her personal triggers', 'alcohol, spicy food, hot drinks, stress', 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('f9f62c8c-448a-5cc0-aa85-10437fd72370', 'ed01e129-72c5-5afc-a6e9-cc01d1bdc6aa', 3, 'Lift Heavy', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('f9f62c8c-448a-5cc0-aa85-10437fd72370', 'do', 'weekly', '2–3 strength sessions with heavy sets', '5–8 reps, last reps hard', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('f9f62c8c-448a-5cc0-aa85-10437fd72370', 'do', 'weekly', 'Jump training 2x a week for bone density', 'jump rope counts', 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('0aba6250-8bbf-5b99-acb2-ec840c2d4760', 'ed01e129-72c5-5afc-a6e9-cc01d1bdc6aa', 4, 'Sprint', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('0aba6250-8bbf-5b99-acb2-ec840c2d4760', 'do', 'weekly', 'Sprint intervals', 'short, all-out, full rest', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('0aba6250-8bbf-5b99-acb2-ec840c2d4760', 'do', 'daily', 'No long medium-intensity cardio', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('fb7cee72-d2c5-564b-98e8-90d320ce44d5', 'ed01e129-72c5-5afc-a6e9-cc01d1bdc6aa', 5, 'Fuel for Menopause', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('fb7cee72-d2c5-564b-98e8-90d320ce44d5', 'eat', 'daily', '40 g+ protein every meal', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('fb7cee72-d2c5-564b-98e8-90d320ce44d5', 'eat', 'daily', 'Calcium foods daily', 'Greek yogurt, sardines, dark greens', 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('fb7cee72-d2c5-564b-98e8-90d320ce44d5', 'take', 'daily', 'Creatine 5 g daily', 'also Supplements', 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('7d817d76-4c3a-5e9d-bb3e-cf0e35dd80ce', 'ed01e129-72c5-5afc-a6e9-cc01d1bdc6aa', 6, 'Calm the System (exit)', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('7d817d76-4c3a-5e9d-bb3e-cf0e35dd80ce', 'do', 'daily', 'A daily stress reset', 'NSDR or physiological sighs', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('7d817d76-4c3a-5e9d-bb3e-cf0e35dd80ce', 'do', 'daily', '7.5 hrs sleep', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('7d817d76-4c3a-5e9d-bb3e-cf0e35dd80ce', 'hit', 'once', 'Her symptom score lower than her Ring 1 baseline for 4 weeks', null, 2);
insert into public.circles (id, slug, name, kind, method_part, goal, see_a_professional, sort) values ('3e38a44a-5215-5ebe-92da-3317cbe6479a', 'knees', 'Knees', 'fixit_ongoing', null, null, 'swelling, locking or catching, the knee gives way, pain after a fall or twist, pain at night or at rest, a hot or red knee, or no improvement after 2 rings (about 4–6 weeks). Hands off to: Strength, and Mobility Ring 6 (Knees Over Toes).', 14);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('863aebaf-ec36-59db-ac4c-596f200fa232', '3e38a44a-5215-5ebe-92da-3317cbe6479a', 1, 'Calm & Move', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('863aebaf-ec36-59db-ac4c-596f200fa232', 'do', 'daily', '5 minutes of backward walking', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('863aebaf-ec36-59db-ac4c-596f200fa232', 'do', 'daily', 'Tibialis raises × 25', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('863aebaf-ec36-59db-ac4c-596f200fa232', 'do', 'daily', 'Straight-leg calf raises × 25', null, 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('bebbb162-daca-5365-876b-aea3eed3f93c', '3e38a44a-5215-5ebe-92da-3317cbe6479a', 2, 'Top Squats & Step-Ups', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('bebbb162-daca-5365-876b-aea3eed3f93c', 'do', 'daily', 'Top-portion squats × 10–20', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('bebbb162-daca-5365-876b-aea3eed3f93c', 'do', 'daily', 'Poliquin step-ups × 8–10', 'the lower the step, the easier', 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('bebbb162-daca-5365-876b-aea3eed3f93c', 'do', 'daily', 'Kneeling squats × 10 + a 10–30 sec hold', null, 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('d34d1558-e458-594a-9c5e-2e5520fdc646', '3e38a44a-5215-5ebe-92da-3317cbe6479a', 3, 'Knee Over Toe', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('d34d1558-e458-594a-9c5e-2e5520fdc646', 'do', 'daily', 'Knee-over-toe calf raises × 25', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('d34d1558-e458-594a-9c5e-2e5520fdc646', 'do', 'daily', 'Knee-over-toe bend, front foot elevated, front heel flat', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('d34d1558-e458-594a-9c5e-2e5520fdc646', 'do', 'daily', 'Half-kneeling toe stretch, 10 sec each side', null, 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('8ca61421-76cf-57b4-aac1-d0d074f1b635', '3e38a44a-5215-5ebe-92da-3317cbe6479a', 4, 'Step-Downs & Slant Board', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('8ca61421-76cf-57b4-aac1-d0d074f1b635', 'do', 'daily', 'Single-leg step-downs × 15 each leg, slow and pain-free', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('8ca61421-76cf-57b4-aac1-d0d074f1b635', 'do', 'daily', 'Slant-board squats × 5–10 with a slow lowering', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('8ca61421-76cf-57b4-aac1-d0d074f1b635', 'do', 'daily', 'Lunge hovers, 3 × 5-sec hold', null, 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('61d8539e-249b-59c0-8c3c-7ed918963120', '3e38a44a-5215-5ebe-92da-3317cbe6479a', 5, 'Full Bend', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('61d8539e-249b-59c0-8c3c-7ed918963120', 'do', 'daily', 'Knee-over-toe bend, front foot on the ground, front heel flat', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('61d8539e-249b-59c0-8c3c-7ed918963120', 'do', 'daily', 'ATG split squats × 5 each side, 5 sec down', 'assisted → unassisted', 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('61d8539e-249b-59c0-8c3c-7ed918963120', 'do', 'daily', 'Couch stretch 30–60 sec each side', null, 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('303f6748-8cc5-522d-ac45-a62e816d1780', '3e38a44a-5215-5ebe-92da-3317cbe6479a', 6, 'Bulletproof Knees (exit)', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('303f6748-8cc5-522d-ac45-a62e816d1780', 'hit', 'once', '10 pain-free bodyweight slant-board squats', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('303f6748-8cc5-522d-ac45-a62e816d1780', 'hit', 'once', '15 controlled step-downs each leg', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('303f6748-8cc5-522d-ac45-a62e816d1780', 'hit', 'once', '60 sec of backward incline walking or sled dragging, pain-free', null, 2);
insert into public.circles (id, slug, name, kind, method_part, goal, see_a_professional, sort) values ('58d8875e-dd3f-59b3-875f-d72476b5ed1b', 'shoulder', 'Shoulder Pain', 'fixit_ongoing', null, null, 'pain after a fall, she can''t lift her arm, night pain that wakes her, weakness, numbness or tingling down the arm, or pain that comes with neck movement, or no improvement after 2 rings. Left shoulder or arm pain with chest pressure or shortness of breath: call 911. Hands off to: Strength Rings 6–8 (the pull-up path).', 15);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('d426793b-9a1d-5777-9402-2e2ee274ed73', '58d8875e-dd3f-59b3-875f-d72476b5ed1b', 1, 'Calm & Open', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('d426793b-9a1d-5777-9402-2e2ee274ed73', 'do', 'daily', 'Band pull-aparts × 20–25', 'crank into external rotation at the chest', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('d426793b-9a1d-5777-9402-2e2ee274ed73', 'do', 'daily', 'Banded protraction × 10', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('d426793b-9a1d-5777-9402-2e2ee274ed73', 'do', 'daily', 'Passive hang 10–30 sec, if pain-free', null, 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('dc037999-116a-5fcb-9cc9-8e34c003e7c6', '58d8875e-dd3f-59b3-875f-d72476b5ed1b', 2, 'Rotator Cuff', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('dc037999-116a-5fcb-9cc9-8e34c003e7c6', 'do', 'daily', 'Band external rotation × 12–15, shoulder blade down and back', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('dc037999-116a-5fcb-9cc9-8e34c003e7c6', 'do', 'daily', 'Dumbbell external rotation 3 × 8, 4 sec down', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('dc037999-116a-5fcb-9cc9-8e34c003e7c6', 'do', 'daily', 'Supermans × 15 + a hold at the top', null, 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('0a031448-0153-59e1-bfde-d33e230a225a', '58d8875e-dd3f-59b3-875f-d72476b5ed1b', 3, 'Back of the Shoulder', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('0a031448-0153-59e1-bfde-d33e230a225a', 'do', 'daily', 'Power raises 3 × 8, 4 sec down', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('0a031448-0153-59e1-bfde-d33e230a225a', 'do', 'daily', 'Face pulls 3 × 15–20', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('0a031448-0153-59e1-bfde-d33e230a225a', 'do', 'daily', 'Trap-3 raises 3 × 8', 'lowering only, if lifting is too hard', 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('fe6129e3-d32a-5324-9f3e-9684eced4330', '58d8875e-dd3f-59b3-875f-d72476b5ed1b', 4, 'Balance the Program', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('fe6129e3-d32a-5324-9f3e-9684eced4330', 'do', 'weekly', '2 pulls for every push in her strength sessions', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('fe6129e3-d32a-5324-9f3e-9684eced4330', 'do', 'daily', 'Active hang 30–45 sec', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('bd12726a-bc50-5455-862f-cf006532d5e7', '58d8875e-dd3f-59b3-875f-d72476b5ed1b', 5, 'Strong Shoulders (exit)', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('bd12726a-bc50-5455-862f-cf006532d5e7', 'hit', 'once', 'Face pulls with half her bodyweight × 20', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('bd12726a-bc50-5455-862f-cf006532d5e7', 'hit', 'once', '45-sec active hang, pain-free', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('bd12726a-bc50-5455-862f-cf006532d5e7', 'hit', 'once', 'Pain-free overhead press and full overhead reach', null, 2);
insert into public.circles (id, slug, name, kind, method_part, goal, see_a_professional, sort) values ('4e0510d7-a513-51c1-8360-b8120aef71d7', 'plantar-fasciitis', 'Plantar Fasciitis', 'fixit_ongoing', null, null, 'pain lasts over 6 weeks despite Rings 1–2, numbness, tingling or burning, she can''t put weight on the foot, swelling or bruising after an injury, or pain at night. Hands off to: Cardio.', 16);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('44e87050-09ad-5aa3-b785-d09061a3ad43', '4e0510d7-a513-51c1-8360-b8120aef71d7', 1, 'Calm It Down', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('44e87050-09ad-5aa3-b785-d09061a3ad43', 'do', 'daily', '2 min of foot massage or trigger-ball rolling per foot', 'around the sore spot, not on it', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('44e87050-09ad-5aa3-b785-d09061a3ad43', 'do', 'daily', 'The "toe glove" (fingers between the toes, circles) 1–2 min', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('44e87050-09ad-5aa3-b785-d09061a3ad43', 'do', 'daily', 'Daily calf stretch', null, 2);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('44e87050-09ad-5aa3-b785-d09061a3ad43', 'do', 'daily', 'Fewer hours standing on hard floors for now', null, 3);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('9a7fc8ca-46ed-5094-9e0c-3ac277273fc1', '4e0510d7-a513-51c1-8360-b8120aef71d7', 2, 'Load It', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('9a7fc8ca-46ed-5094-9e0c-3ac277273fc1', 'do', 'weekly', 'Standing toe extensions 3 × 20 each foot', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('9a7fc8ca-46ed-5094-9e0c-3ac277273fc1', 'do', 'daily', 'Dorsiflexion sit (kneeling, toes tucked) up to 2 min', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('9a7fc8ca-46ed-5094-9e0c-3ac277273fc1', 'do', 'daily', 'Straight-leg calf raises × 25', null, 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('ebbad546-e273-5c52-9dad-9e3c2c315c72', '4e0510d7-a513-51c1-8360-b8120aef71d7', 3, 'Balance', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('ebbad546-e273-5c52-9dad-9e3c2c315c72', 'do', 'daily', 'The Y-balance drill, 2–3 rounds each leg', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('ebbad546-e273-5c52-9dad-9e3c2c315c72', 'do', 'daily', '30-sec single-leg balance, barefoot', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('ebbad546-e273-5c52-9dad-9e3c2c315c72', 'do', 'daily', 'Tibialis raises × 25', null, 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('bf718ea4-4ec3-5974-8850-5d9ea62c2e1e', '4e0510d7-a513-51c1-8360-b8120aef71d7', 4, 'Step-Downs', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('bf718ea4-4ec3-5974-8850-5d9ea62c2e1e', 'do', 'daily', 'Step-up and step-down progression on a step: two legs → two up, one down → one leg', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('bf718ea4-4ec3-5974-8850-5d9ea62c2e1e', 'do', 'daily', 'Knee-over-toe calf raises × 25', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('6b4ddd8f-4449-5c74-9c54-c35764d7e1e2', '4e0510d7-a513-51c1-8360-b8120aef71d7', 5, 'Back on Her Feet (exit)', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('6b4ddd8f-4449-5c74-9c54-c35764d7e1e2', 'hit', 'once', '25 single-leg calf raises each side, pain-free', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('6b4ddd8f-4449-5c74-9c54-c35764d7e1e2', 'hit', 'once', '10,000 daily steps and 1,000 weekly jumps with no morning heel pain for 2 weeks', null, 1);
insert into public.circles (id, slug, name, kind, method_part, goal, see_a_professional, sort) values ('78d07925-c343-5a6b-9450-7c5fa165fd04', 'hips', 'Hip Imbalances', 'fixit_ongoing', null, null, 'groin pain with clicking, locking or catching, pain after a fall, pain that wakes her at night, numbness or pain shooting down the leg, limping, or no improvement after 2 rings. Hands off to: Mobility & Desk Body.', 17);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('9ea2aec8-33cf-5620-a403-e4025d2f0fc5', '78d07925-c343-5a6b-9450-7c5fa165fd04', 1, 'Find & Open', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('9ea2aec8-33cf-5620-a403-e4025d2f0fc5', 'hit', 'once', 'A baseline video of her split squat and single-leg balance on each side', 'finds her weaker side', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('9ea2aec8-33cf-5620-a403-e4025d2f0fc5', 'do', 'daily', 'Couch stretch 30–60 sec each side', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('9ea2aec8-33cf-5620-a403-e4025d2f0fc5', 'do', 'daily', '90/90 hip switches × 10', null, 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('dbe51c42-1b35-56af-990f-3a9a201e0847', '78d07925-c343-5a6b-9450-7c5fa165fd04', 2, 'Split Squat', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('dbe51c42-1b35-56af-990f-3a9a201e0847', 'do', 'daily', 'ATG split squats × 10 each side, front foot elevated and hand-assisted, slow', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('dbe51c42-1b35-56af-990f-3a9a201e0847', 'do', 'daily', 'Weaker side first, plus one extra set on it', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('cd3c1e8b-3338-5b74-9ead-c816e91683e2', '78d07925-c343-5a6b-9450-7c5fa165fd04', 3, 'Inner Thighs & Hamstrings', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('cd3c1e8b-3338-5b74-9ead-c816e91683e2', 'do', 'daily', 'Seated good mornings × 10–15', 'straddle, chest toward the bench', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('cd3c1e8b-3338-5b74-9ead-c816e91683e2', 'do', 'daily', 'Pancake or straddle stretch 1 min', null, 1);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('0f1a25dd-c01c-5a56-b464-c4ca80dc1166', '78d07925-c343-5a6b-9450-7c5fa165fd04', 4, 'Hip Flexors & Back', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('0f1a25dd-c01c-5a56-b464-c4ca80dc1166', 'do', 'daily', 'Standing hip flexor raises or hanging knee raises × 15', null, 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('0f1a25dd-c01c-5a56-b464-c4ca80dc1166', 'do', 'daily', 'Light back extensions × 15–20', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('0f1a25dd-c01c-5a56-b464-c4ca80dc1166', 'do', 'daily', 'Side bends × 15 each side', null, 2);
insert into public.rings (id, circle_id, ring_number, name, outcome) values ('996b498a-9633-5ad6-a486-731041700f20', '78d07925-c343-5a6b-9450-7c5fa165fd04', 5, 'Balanced Hips (exit)', null);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('996b498a-9633-5ad6-a486-731041700f20', 'hit', 'once', 'ATG split squat on flat ground both sides', 'front hamstring covers the calf, heel down, back knee off the floor', 0);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('996b498a-9633-5ad6-a486-731041700f20', 'hit', 'once', '30-sec single-leg balance on each side', null, 1);
insert into public.ring_items (ring_id, item_type, cadence, title, detail, sort) values ('996b498a-9633-5ad6-a486-731041700f20', 'hit', 'once', '90/90 equal on both sides', null, 2);
commit;
-- Generated by scripts/build_trajectory_seed.py from doc 27. Do not edit by hand.
begin;
delete from public.trajectory_weeks;
insert into public.trajectory_weeks (week_number, phase, checkin_type, checkin_is_video, is_diet_break, moments) values (1, 'rested', 'week1', false, false, '{upsell_1,onboarding_call}');
insert into public.trajectory_week_rings (week_number, ring_id) values (1, '9a3e8c4e-6bb2-56bd-8f85-bd3bdda6959c') on conflict do nothing;
insert into public.trajectory_week_rings (week_number, ring_id) values (1, '92c3f5ee-47ef-59e6-b53b-e5982b849ec3') on conflict do nothing;
insert into public.trajectory_week_rings (week_number, ring_id) values (1, 'd0ed56a1-4d64-566c-82c3-a27d36ef3dea') on conflict do nothing;
insert into public.trajectory_weeks (week_number, phase, checkin_type, checkin_is_video, is_diet_break, moments) values (2, 'rested', 'standard', false, false, '{}');
insert into public.trajectory_week_rings (week_number, ring_id) values (2, 'db1fbde6-cd3f-5e03-a35c-840c3026d00f') on conflict do nothing;
insert into public.trajectory_week_rings (week_number, ring_id) values (2, '200cbae3-89df-59db-81df-3508e6f8eccf') on conflict do nothing;
insert into public.trajectory_week_rings (week_number, ring_id) values (2, 'e5f0e0d4-91da-56b3-8898-44d5b0ec8633') on conflict do nothing;
insert into public.trajectory_weeks (week_number, phase, checkin_type, checkin_is_video, is_diet_break, moments) values (3, 'rested', 'standard', false, false, '{}');
insert into public.trajectory_week_rings (week_number, ring_id) values (3, '98fa0f5c-0658-51ff-b339-9112f735c0d0') on conflict do nothing;
insert into public.trajectory_week_rings (week_number, ring_id) values (3, 'a64da852-0a8d-5c1d-b78f-756fe922061a') on conflict do nothing;
insert into public.trajectory_weeks (week_number, phase, checkin_type, checkin_is_video, is_diet_break, moments) values (4, 'rested', 'four_week', true, false, '{upsell_2,sleep_better_checkpoint}');
insert into public.trajectory_week_rings (week_number, ring_id) values (4, 'fbd0ffa4-f406-5951-b123-0a3ab6ad9335') on conflict do nothing;
insert into public.trajectory_week_rings (week_number, ring_id) values (4, '38b9f5cb-dfab-57b7-9001-19305d94f47a') on conflict do nothing;
insert into public.trajectory_week_rings (week_number, ring_id) values (4, 'df0d20c3-dfd4-5153-a5d1-7653f88535fa') on conflict do nothing;
insert into public.trajectory_weeks (week_number, phase, checkin_type, checkin_is_video, is_diet_break, moments) values (5, 'fueled', 'standard', false, false, '{}');
insert into public.trajectory_week_rings (week_number, ring_id) values (5, '665e0ead-370e-51d6-bbbb-688b5b484cc6') on conflict do nothing;
insert into public.trajectory_week_rings (week_number, ring_id) values (5, '8c004e26-422d-53b1-bc5e-5f790a0726dc') on conflict do nothing;
insert into public.trajectory_weeks (week_number, phase, checkin_type, checkin_is_video, is_diet_break, moments) values (6, 'fueled', 'standard', false, false, '{}');
insert into public.trajectory_week_rings (week_number, ring_id) values (6, 'c3d972f1-ba35-52d1-b44b-b434b2c10c23') on conflict do nothing;
insert into public.trajectory_week_rings (week_number, ring_id) values (6, '973ac12a-da9d-540c-aca8-3b1ebe8d4e9e') on conflict do nothing;
insert into public.trajectory_weeks (week_number, phase, checkin_type, checkin_is_video, is_diet_break, moments) values (7, 'fueled', 'standard', false, false, '{}');
insert into public.trajectory_week_rings (week_number, ring_id) values (7, 'ebe6a6b1-dac9-529e-910b-5c884e6c80c0') on conflict do nothing;
insert into public.trajectory_week_rings (week_number, ring_id) values (7, '85025f60-48ff-5d76-bacd-929b7d4d0a3b') on conflict do nothing;
insert into public.trajectory_weeks (week_number, phase, checkin_type, checkin_is_video, is_diet_break, moments) values (8, 'fueled', 'four_week', true, true, '{}');
insert into public.trajectory_week_rings (week_number, ring_id) values (8, '558eded8-e3c1-5f17-93db-bb1f8611c8b1') on conflict do nothing;
insert into public.trajectory_weeks (week_number, phase, checkin_type, checkin_is_video, is_diet_break, moments) values (9, 'fueled', 'standard', false, false, '{}');
insert into public.trajectory_week_rings (week_number, ring_id) values (9, '4010f7f7-ecfc-54b3-8f8c-0b58dddbef56') on conflict do nothing;
insert into public.trajectory_week_rings (week_number, ring_id) values (9, '48cae10d-5082-5307-96f0-2bffa714603c') on conflict do nothing;
insert into public.trajectory_weeks (week_number, phase, checkin_type, checkin_is_video, is_diet_break, moments) values (10, 'fueled', 'standard', false, false, '{}');
insert into public.trajectory_week_rings (week_number, ring_id) values (10, '7c980c49-98a3-5240-98aa-c70f99b138af') on conflict do nothing;
insert into public.trajectory_week_rings (week_number, ring_id) values (10, '80440c6e-8cc4-55b7-8ef8-9ef6016fa4be') on conflict do nothing;
insert into public.trajectory_weeks (week_number, phase, checkin_type, checkin_is_video, is_diet_break, moments) values (11, 'fueled', 'standard', false, false, '{}');
insert into public.trajectory_week_rings (week_number, ring_id) values (11, 'dba8feac-e929-5342-a9a0-7685906d0a91') on conflict do nothing;
insert into public.trajectory_week_rings (week_number, ring_id) values (11, '357d7314-a692-55ba-bae0-90075f0b17ae') on conflict do nothing;
insert into public.trajectory_weeks (week_number, phase, checkin_type, checkin_is_video, is_diet_break, moments) values (12, 'fueled', 'milestone', true, false, '{}');
insert into public.trajectory_week_rings (week_number, ring_id) values (12, '991ae2b0-9f65-5dc6-ab05-084faa6a08ac') on conflict do nothing;
insert into public.trajectory_week_rings (week_number, ring_id) values (12, '1ea6afde-aef0-54f8-b3ac-5dc3af12d61a') on conflict do nothing;
insert into public.trajectory_weeks (week_number, phase, checkin_type, checkin_is_video, is_diet_break, moments) values (13, 'fueled', 'halfway', false, false, '{upsell_3}');
insert into public.trajectory_week_rings (week_number, ring_id) values (13, 'b3e6e67a-3a75-58ad-85dd-045938ea4f79') on conflict do nothing;
insert into public.trajectory_week_rings (week_number, ring_id) values (13, '5fecadba-aede-5c50-8ef5-b51e654b1d78') on conflict do nothing;
insert into public.trajectory_weeks (week_number, phase, checkin_type, checkin_is_video, is_diet_break, moments) values (14, 'fueled', 'standard', false, false, '{}');
insert into public.trajectory_week_rings (week_number, ring_id) values (14, 'b8ba378d-8cad-5964-9535-4fee1d889076') on conflict do nothing;
insert into public.trajectory_week_rings (week_number, ring_id) values (14, '5d22d33d-d58c-5755-90c3-1732a81cb66b') on conflict do nothing;
insert into public.trajectory_weeks (week_number, phase, checkin_type, checkin_is_video, is_diet_break, moments) values (15, 'fueled', 'standard', false, false, '{}');
insert into public.trajectory_week_rings (week_number, ring_id) values (15, '4f52222a-4821-5a5e-97a2-cc5de7fa1152') on conflict do nothing;
insert into public.trajectory_week_rings (week_number, ring_id) values (15, '0d24b7e8-3eef-5e1b-92cc-d82c1dcdbd1f') on conflict do nothing;
insert into public.trajectory_weeks (week_number, phase, checkin_type, checkin_is_video, is_diet_break, moments) values (16, 'fueled', 'four_week', true, true, '{}');
insert into public.trajectory_week_rings (week_number, ring_id) values (16, '8fbacca7-bbab-5d1a-81c3-dbacb28510f4') on conflict do nothing;
insert into public.trajectory_weeks (week_number, phase, checkin_type, checkin_is_video, is_diet_break, moments) values (17, 'driven', 'standard', false, false, '{}');
insert into public.trajectory_week_rings (week_number, ring_id) values (17, '6f693e9d-3a09-5d66-976b-dac9b1643444') on conflict do nothing;
insert into public.trajectory_week_rings (week_number, ring_id) values (17, 'fd2ff797-a58a-529a-9fd5-ffd0d67b228f') on conflict do nothing;
insert into public.trajectory_weeks (week_number, phase, checkin_type, checkin_is_video, is_diet_break, moments) values (18, 'driven', 'standard', false, false, '{}');
insert into public.trajectory_week_rings (week_number, ring_id) values (18, 'b81b378e-0e1a-5c29-bdb9-fdeadbc5c9fe') on conflict do nothing;
insert into public.trajectory_week_rings (week_number, ring_id) values (18, 'cf5c3e07-38ea-5aa8-b658-5c2a8fb3d2f7') on conflict do nothing;
insert into public.trajectory_weeks (week_number, phase, checkin_type, checkin_is_video, is_diet_break, moments) values (19, 'driven', 'standard', false, false, '{}');
insert into public.trajectory_week_rings (week_number, ring_id) values (19, '93a668d6-aacf-5b0f-91a6-2267d7c59900') on conflict do nothing;
insert into public.trajectory_week_rings (week_number, ring_id) values (19, 'f823efce-04f2-51c2-9e96-a1b864945a34') on conflict do nothing;
insert into public.trajectory_weeks (week_number, phase, checkin_type, checkin_is_video, is_diet_break, moments) values (20, 'driven', 'four_week', true, false, '{}');
insert into public.trajectory_week_rings (week_number, ring_id) values (20, 'bd068057-85c4-5ff1-808b-778955a179bf') on conflict do nothing;
insert into public.trajectory_week_rings (week_number, ring_id) values (20, 'fff7e180-252c-5790-9847-6c79c8cc4ed3') on conflict do nothing;
insert into public.trajectory_weeks (week_number, phase, checkin_type, checkin_is_video, is_diet_break, moments) values (21, 'driven', 'standard', false, false, '{}');
insert into public.trajectory_week_rings (week_number, ring_id) values (21, '7e81e984-9ce7-533f-b87b-e4032e80744a') on conflict do nothing;
insert into public.trajectory_week_rings (week_number, ring_id) values (21, 'f8cfb55d-fccf-53a0-8a96-0e133518ecbf') on conflict do nothing;
insert into public.trajectory_weeks (week_number, phase, checkin_type, checkin_is_video, is_diet_break, moments) values (22, 'driven', 'standard', false, false, '{}');
insert into public.trajectory_week_rings (week_number, ring_id) values (22, 'e294e387-38a4-52af-9140-1e4edbbbbae1') on conflict do nothing;
insert into public.trajectory_week_rings (week_number, ring_id) values (22, '609ace7d-dda0-59c9-bc4c-e414f8b585f3') on conflict do nothing;
insert into public.trajectory_weeks (week_number, phase, checkin_type, checkin_is_video, is_diet_break, moments) values (23, 'driven', 'standard', false, false, '{}');
insert into public.trajectory_week_rings (week_number, ring_id) values (23, 'd76f4d67-3392-5973-8784-b17786d8bca2') on conflict do nothing;
insert into public.trajectory_week_rings (week_number, ring_id) values (23, '4c5fb2b6-f324-5a5f-84b7-71d02ebde4ce') on conflict do nothing;
insert into public.trajectory_weeks (week_number, phase, checkin_type, checkin_is_video, is_diet_break, moments) values (24, 'driven', 'last_chance', false, true, '{last_chance}');
insert into public.trajectory_week_rings (week_number, ring_id) values (24, 'dc36278c-fa2e-5d98-8bec-239e8edc8886') on conflict do nothing;
insert into public.trajectory_weeks (week_number, phase, checkin_type, checkin_is_video, is_diet_break, moments) values (25, 'driven', 'standard', false, false, '{}');
insert into public.trajectory_week_rings (week_number, ring_id) values (25, 'a959a28a-87c5-5091-b95b-0030d274a4df') on conflict do nothing;
insert into public.trajectory_week_rings (week_number, ring_id) values (25, 'a727ea99-a8d7-5e99-80c8-0553f333ec1a') on conflict do nothing;
insert into public.trajectory_weeks (week_number, phase, checkin_type, checkin_is_video, is_diet_break, moments) values (26, 'driven', 'results', true, false, '{guarantee_15lb}');
commit;
