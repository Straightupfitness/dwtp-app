-- Workout history from Trainerize (October 29): every workout clients tracked, with each set's reps and weight.
-- Shown on Workouts → History (and to Michael on each client's page). Each imported set also feeds
-- "Last time" in the workout player. Safe to run more than once.

create table if not exists public.workout_history (
  id bigint primary key,                 -- Trainerize daily workout id
  client_id uuid not null references public.profiles (id) on delete cascade,
  performed_on date not null,
  name text not null,
  kind text,                             -- workoutRegular · cardio · …
  minutes int,
  calories int,
  source text not null default 'trainerize',
  exercises jsonb not null default '[]', -- [{ex, name, rec, note, sets:[[set, reps, weight, seconds, distance, calories]]}]
  created_at timestamptz not null default now()
);
create index if not exists workout_history_client on public.workout_history (client_id, performed_on desc);

create table if not exists public.history_sets (
  history_id bigint not null references public.workout_history (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  position int not null,
  set_no int not null,
  exercise_id bigint,                    -- Trainerize exercise id (same ids as the app's exercises)
  exercise_name text,
  reps int, weight numeric, seconds int, distance numeric,
  performed_on date not null,
  primary key (history_id, position, set_no)
);
create index if not exists history_sets_exercise on public.history_sets (client_id, exercise_id, performed_on desc);

do $$
declare t text;
begin
  foreach t in array array['workout_history','history_sets'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for select using (client_id = auth.uid() or public.is_coach())', t);
    execute format('drop policy if exists "coach writes" on public.%I', t);
    execute format('create policy "coach writes" on public.%I for all using (public.is_coach()) with check (public.is_coach())', t);
  end loop;
end $$;

select 'ok' as workout_history;
