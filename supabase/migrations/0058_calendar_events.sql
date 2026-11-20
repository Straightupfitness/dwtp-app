-- November 20 (Michael): things on his calendar that come back: every week (his training sessions, check-in replies…)
-- and every year (birthdays, remembrance days). Yearly ones also send him a reminder 2 days before. Coach only.
-- (His own list is added by a separate file that isn't kept in the code.)
create table if not exists public.kpi_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null check (kind in ('weekly', 'yearly')),
  weekday int check (weekday between 0 and 6),          -- weekly: 0 = Sunday … 6 = Saturday
  month int check (month between 1 and 12),             -- yearly
  day int check (day between 1 and 31),                 -- yearly
  start_min int check (start_min between 0 and 1439),   -- minutes after midnight; empty = all day
  minutes int not null default 60 check (minutes between 5 and 720),
  icon text,
  note text,
  created_at timestamptz not null default now()
);
alter table public.kpi_events enable row level security;
drop policy if exists "coach only" on public.kpi_events;
create policy "coach only" on public.kpi_events for all using (public.is_coach()) with check (public.is_coach());
do $$ begin
  if to_regclass('public.undo_log') is not null then
    drop trigger if exists undo_record on public.kpi_events;
    create trigger undo_record after insert or update or delete on public.kpi_events for each row execute function public.undo_record();
  end if;
end $$;
