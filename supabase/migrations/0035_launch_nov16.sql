-- Launch moved to Monday, November 16 (November 6). Everyone who starts Nov 9 now starts Nov 16:
-- week 1, onboarding, the first Strong Body Wednesday (Nov 18), Strong Mind Friday and in-app check-in (Nov 20).
-- Workouts keep going without a gap: "start her at program week" moves forward one week, and workouts already
-- logged keep their place. Safe to run more than once (after the first run nobody starts Nov 9 any more).
begin;

create temporary table launch_shift2 on commit drop as
  select id, ((date '2026-11-16' - program_start) / 7)::int as k
  from public.profiles
  where role = 'client' and program_start = date '2026-11-09';

update public.workout_sessions s set program_week = s.program_week - l.k - 1000 from launch_shift2 l where s.client_id = l.id;
update public.workout_sessions s set program_week = s.program_week + 1000 from launch_shift2 l where s.client_id = l.id;
update public.checkins c set week_number = c.week_number - l.k - 1000 from launch_shift2 l where c.client_id = l.id;
update public.checkins c set week_number = c.week_number + 1000 from launch_shift2 l where c.client_id = l.id;
update public.profiles p set program_start = date '2026-11-16', workout_start_week = coalesce(p.workout_start_week, 1) + l.k
  from launch_shift2 l where p.id = l.id;

commit;

select count(*) filter (where program_start = date '2026-11-16') as starting_nov_16, count(*) as clients
from public.profiles where role = 'client';
