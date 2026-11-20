-- November 19 (Michael): KPIs, part 2.
-- 1. The day of the month each expense comes out of the account.
-- 2. When each client started (for the online list, sorted by sign-up date). Filled in for paid-in-full clients from
--    their expiry date and length; you can change it in the app.
-- 3. His planner on the KPIs tab: the action plan, the Eisenhower matrix and his Workflowy-style outline, all in one
--    table (kind = action / matrix / outline). Coach only.
alter table public.kpi_expenses add column if not exists draw_day int check (draw_day between 1 and 31);
alter table public.kpi_clients add column if not exists started_on date;
update public.kpi_clients set started_on = expires_on - (paid_weeks * 7)
  where started_on is null and expires_on is not null and paid_weeks is not null;

create table if not exists public.kpi_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('action', 'matrix', 'outline')),
  parent_id uuid references public.kpi_items(id) on delete cascade,
  text text not null default '',
  note text,
  quadrant int check (quadrant between 1 and 4),
  position double precision not null default 0,
  done boolean not null default false,
  collapsed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists kpi_items_kind on public.kpi_items (kind, parent_id, position);
alter table public.kpi_items enable row level security;
drop policy if exists "coach only" on public.kpi_items;
create policy "coach only" on public.kpi_items for all using (public.is_coach()) with check (public.is_coach());

select 'ok' as kpi_planner_ready, (select count(*) from public.kpi_clients where started_on is not null) as clients_with_start_date;
