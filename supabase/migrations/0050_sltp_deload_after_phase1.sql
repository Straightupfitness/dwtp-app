-- November 17 (Joanna): SLTP had no deload week after SL Phase 1 (lost in the Trainerize import); Phase 2 and 3 have
-- one. Adds it (same workouts as the other SLTP deloads) as program week 16, and moves every later phase one week
-- later. Clients already past week 16 keep doing exactly the workouts they're on (their start week moves up by 1).
-- Safe to run once; running it again does nothing (it checks the deload is already there).
do $$
declare
  src bigint; new_id bigint;
begin
  if exists (select 1 from public.program_phases where program = 'sltp' and kind = 'deload' and first_week = 16) then
    raise notice 'Already done'; return;
  end if;

  -- Clients already past week 15 of SLTP: same workouts as before.
  update public.profiles
     set workout_start_week = workout_start_week + 1
   where workout_program = 'sltp' and program_start is not null
     and greatest(0, floor((current_date - program_start) / 7.0)::int + 1) + workout_start_week - 1 >= 16;

  -- Room for the new phase (two steps so (program, position) never collides).
  update public.program_phases set position = position + 1000 where program = 'sltp' and position >= 8;
  update public.program_phases set position = position - 999, first_week = first_week + 1 where program = 'sltp' and position >= 1008;

  select id into src from public.program_phases where program = 'sltp' and kind = 'deload' and name ilike 'SLTP Deload%' order by position limit 1;
  select coalesce(max(id), 0) + 1 into new_id from public.program_phases;
  insert into public.program_phases (id, program, position, name, stage, kind, weeks, first_week)
    select new_id, 'sltp', 8, name, stage, 'deload', 1, 16 from public.program_phases where id = src;
  insert into public.phase_workouts (phase_id, workout_id, day)
    select new_id, workout_id, day from public.phase_workouts where phase_id = src;
end $$;

select position, name, first_week, weeks from public.program_phases where program = 'sltp' and position between 6 and 13 order by position;
select full_name, workout_start_week from public.profiles where workout_program = 'sltp' and workout_start_week >= 15 order by workout_start_week;
