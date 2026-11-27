-- SQL 41 (November 26, Michael): four things.
-- 1. "I reached out" on the client overview counts texts he sends from his phone through the app.
-- 2. Clients can log their weight in kilograms (stored in pounds; shown in her unit).
-- 3. His calendar (KPIs tab): one-time events, and a phone reminder before any timed event (1 hour by default).
--    A job in Supabase checks every 5 minutes and asks the app to send the reminders that are due.
-- 4. Her 3 go-to meals and "How much will this cost?" (ingredients, store, package price, shopping list).
-- Plus: the Menopause Symptoms "Log your symptoms every day" habit gets steps for turning on the cycle tracker.
-- Safe to run more than once.

-- 1 + 2
alter table public.profiles add column if not exists last_texted_at timestamptz;
alter table public.profiles add column if not exists weight_unit text not null default 'lbs';
alter table public.profiles drop constraint if exists profiles_weight_unit_check;
alter table public.profiles add constraint profiles_weight_unit_check check (weight_unit in ('lbs', 'kg'));

-- 3: one-time events and reminders
alter table public.kpi_events add column if not exists on_date date;          -- one-time events
alter table public.kpi_events add column if not exists remind_min int;        -- minutes before; empty = no reminder
alter table public.kpi_events drop constraint if exists kpi_events_kind_check;
alter table public.kpi_events add constraint kpi_events_kind_check check (kind in ('weekly', 'yearly', 'once'));
alter table public.kpi_events drop constraint if exists kpi_events_remind_min_check;
alter table public.kpi_events add constraint kpi_events_remind_min_check check (remind_min is null or remind_min between 0 and 10080);

-- The every-5-minutes job: it calls the app with a private token (kept in app_config, which only the server can read).
insert into public.app_config (key, value) values ('events_cron_token', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
  on conflict (key) do nothing;
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'dwtp-event-reminders';
  perform cron.schedule('dwtp-event-reminders', '*/5 * * * *', $job$
    select net.http_get(
      url := 'https://app.straightupfitness.com/api/cron/events',
      headers := jsonb_build_object('x-cron-token', (select value from public.app_config where key = 'events_cron_token'))
    );
  $job$);
end $$;

-- 4: her go-to meals (3 main, up to 3 backups). items = [{ name, qty, unit, brand, store, pkg_qty, pkg_unit, pkg_price, kcal, protein, fiber }]
create table if not exists public.go_to_meals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  position int not null check (position between 1 and 6),
  name text,
  items jsonb not null default '[]'::jsonb,
  currency text not null default '$',
  updated_at timestamptz not null default now(),
  unique (client_id, position)
);
alter table public.go_to_meals enable row level security;
drop policy if exists "her own, and the coach" on public.go_to_meals;
create policy "her own, and the coach" on public.go_to_meals for all
  using (client_id = auth.uid() or public.is_coach()) with check (client_id = auth.uid() or public.is_coach());

-- Menopause Symptoms: how to turn on the cycle tracker.
update public.ring_items set how_to = jsonb_build_object(
  'title', 'Turn on your cycle tracker',
  'steps', jsonb_build_array(
    'Tap your photo (Account) in the top right corner of the app.',
    'Tap "Cycle tracker".',
    'Pick "No period (perimenopause or menopause)". If you still get a period, pick "Track my period" instead.',
    'Go back to Today. Your cycle card now shows under "Track your numbers".',
    'Every day, tap your energy and the symptoms you had: hot flashes, night sweats, brain fog, mood swings and so on. Log the good days too.'
  ),
  'why', 'After a few weeks we can see the pattern: what''s menopause, and what''s sleep or stress. It also tells you on workout days whether to go heavy, normal or lighter.'
) where id = '8e0f21d5-cbeb-437c-8480-0a0ab0205fb7';
