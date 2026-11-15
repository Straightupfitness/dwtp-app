-- November 15 (Claudia): Michael can set which program day she does on which weekday, e.g. {"1": 2, "2": 1, "4": 3}
-- = Monday Day 2, Tuesday Day 1, Thursday Day 3 (0 = Sunday … 6 = Saturday). Follows the program into every phase.
alter table public.profiles add column if not exists workout_schedule jsonb;
