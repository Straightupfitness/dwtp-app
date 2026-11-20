-- November 20 (Michael): a 7-day scheduler above the Eisenhower matrix. Drag a task into a day and time; it stays in
-- its box too. When it starts and how long it takes.
alter table public.kpi_items add column if not exists sched_at timestamptz;
alter table public.kpi_items add column if not exists sched_minutes int check (sched_minutes between 15 and 720);
select 'ok' as planner_schedule_ready;
