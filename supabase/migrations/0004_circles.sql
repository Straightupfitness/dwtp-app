-- Capacity Circles screen support.
-- 1. habit_key: the same habit living in two circles (blackout shades in Circadian Reset and Healthy Home).
--    Checking it off anywhere logs it for every item with the same key, so the credit carries over,
--    even into a circle that hasn't opened yet.
-- 2. cp_totals: her all-time and this-week Capacity Points, summed in the database.
-- Safe to run more than once. Re-run after re-seeding the circles (seed/01_circles.sql).

alter table public.ring_items add column if not exists habit_key text;
create index if not exists ring_items_habit_key on public.ring_items (habit_key) where habit_key is not null;

create or replace function pg_temp.link(key text, circle_slug text, ring int, title_start text) returns void
language sql as $$
  update public.ring_items i set habit_key = key
  from public.rings r join public.circles c on c.id = r.circle_id
  where i.ring_id = r.id and c.slug = circle_slug and r.ring_number = ring and i.title ilike title_start || '%';
$$;

select pg_temp.link('walk-after-meals',  'circadian-reset', 3, '10-min walk after every meal');
select pg_temp.link('walk-after-meals',  'cardio',          2, '10-minute walk after every meal');
select pg_temp.link('l-theanine',        'circadian-reset', 4, 'L-theanine');
select pg_temp.link('l-theanine',        'supplements',     2, 'L-theanine');
select pg_temp.link('blackout-shades',   'circadian-reset', 5, 'Blackout shades');
select pg_temp.link('blackout-shades',   'healthy-home',    1, 'Blackout shades');
select pg_temp.link('tech-free-bedroom', 'circadian-reset', 5, 'Tech-free bedroom');
select pg_temp.link('tech-free-bedroom', 'healthy-home',    1, 'TV out, real alarm clock');
select pg_temp.link('morning-steps',     'circadian-reset', 7, '2,000 steps within 60 min');
select pg_temp.link('morning-steps',     'cardio',          1, '2,000 of them within 60 minutes');
select pg_temp.link('sprints',           'circadian-reset', 9, '3 × 10-second sprints');
select pg_temp.link('sprints',           'cardio',          5, '6 hill sprints');
select pg_temp.link('standing-desk',     'mobility',        4, 'Standing desk');
select pg_temp.link('standing-desk',     'healthy-home',    6, 'Standing desk');
select pg_temp.link('weigh-in',          'food-philosophy', 1, 'Weigh in daily');
select pg_temp.link('weigh-in',          'mindset',         1, 'Weigh in daily');
select pg_temp.link('weigh-in',          'holidays-events', 3, 'Weigh in');
select pg_temp.link('log-food',          'food-philosophy', 1, 'Eat whatever she wants');
select pg_temp.link('creatine',          'supplements',     1, 'Creatine');
select pg_temp.link('creatine',          'menopause',       5, 'Creatine');

create or replace view public.cp_totals with (security_invoker = true) as
  select client_id,
         coalesce(sum(points), 0)::int as total,
         coalesce(sum(points) filter (where created_at >= date_trunc('week', now())), 0)::int as this_week
  from public.cp_ledger
  group by client_id;

-- Check: 10 keys; weigh-in has 3 items, log-food 1, the rest 2.
-- weigh-in and log-food check themselves off when she logs her weight or a meal.
select habit_key, count(*) from public.ring_items where habit_key is not null group by habit_key order by habit_key;

-- 3. opened_early: Michael opened this ring for her ahead of her plan (from the coach dashboard).
--    A circle with an early-opened ring works like a focus circle: the next ring opens on day 8.
alter table public.client_rings add column if not exists opened_early boolean not null default false;
