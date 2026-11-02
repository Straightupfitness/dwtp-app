-- November 9 launch (November 1). Every client's 26-week journey starts Monday, November 9:
-- onboarding Nov 9, first Strong Body Wednesday Nov 11, first Strong Mind Friday Nov 13, first app check-in Nov 13.
-- Workouts keep going without a gap: "start her at program week" moves forward by the same number of weeks,
-- and workouts and check-ins already done are renumbered to match (they become pre-launch weeks: 0, -1, -2).
-- Safe to run more than once (after the first run nobody starts before Nov 9 any more).

begin;

create temporary table launch_shift on commit drop as
  select id, ((date '2026-11-09' - program_start) / 7)::int as k
  from public.profiles
  where role = 'client' and program_start is not null and program_start < date '2026-11-09';

-- Workouts she already did: same training weeks, new numbers. (Two steps so the unique key never collides.)
update public.workout_sessions s set program_week = s.program_week - l.k - 1000 from launch_shift l where s.client_id = l.id and l.k > 0;
update public.workout_sessions s set program_week = s.program_week + 1000 from launch_shift l where s.client_id = l.id and l.k > 0;

-- Check-ins already sent in the app become pre-launch check-ins.
update public.checkins c set week_number = c.week_number - l.k - 1000 from launch_shift l where c.client_id = l.id and l.k > 0;
update public.checkins c set week_number = c.week_number + 1000 from launch_shift l where c.client_id = l.id and l.k > 0;

-- So Week 1's Strong Body Wednesday, Strong Mind Friday and check-in reminders go out again from Nov 11.
delete from public.notification_log n using launch_shift l
  where n.user_id = l.id and (n.key like 'sbw:%' or n.key like 'smf:%' or n.key like 'checkin-open:%' or n.key like 'checkin-last-call:%' or n.key like 'hh-ready:%');

-- The new start date, and her workouts carry on where they are.
update public.profiles p set program_start = date '2026-11-09', workout_start_week = coalesce(p.workout_start_week, 1) + l.k
  from launch_shift l where p.id = l.id;

commit;

select count(*) filter (where program_start = date '2026-11-09') as starting_nov_9, count(*) as clients
from public.profiles where role = 'client';
