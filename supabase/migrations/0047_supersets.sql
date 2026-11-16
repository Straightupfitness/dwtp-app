-- November 15 (Michael): supersets. Exercises in a workout that share a letter (A, B, …) are done back to back:
-- one set of each, then rest, then the next round. Null = straight sets.
alter table public.workout_items add column if not exists superset text;

-- Diesel Strong P1D2 (Trainerize's supersets didn't come across in the import), the original and every copy of it,
-- including Claudia's custom program:
--   A: Band Pull Aparts → Under-The-Bench Extensions → Pulley Seated Lat Pulldowns
--   B: Incline DB Row (hold) → Incline DB Row → Incline DB Rear Raises
update public.workout_items wi set superset = 'A'
  from public.workouts w
  where w.id = wi.workout_id and w.name = 'Diesel Strong P1D2' and wi.exercise_id in (5086616, 5400631, 5103269);
update public.workout_items wi set superset = 'B'
  from public.workouts w
  where w.id = wi.workout_id and w.name = 'Diesel Strong P1D2' and wi.exercise_id in (5089936, 5096509);

select w.id, w.name, wi.position, e.name as exercise, wi.superset
  from public.workout_items wi join public.workouts w on w.id = wi.workout_id join public.exercises e on e.id = wi.exercise_id
  where w.name = 'Diesel Strong P1D2' order by w.id, wi.position;
