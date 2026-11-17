-- November 17 (Michael): a KPIs tab for him. His expenses (business and personal), his time slots (rent and the
-- 2027 plan), what each client pays (monthly, or paid in full until a date, and the renewal he offered), and
-- one-time payments. Coach only. The numbers themselves are entered in the app, not here.
create table if not exists public.kpi_expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'business' check (category in ('business', 'personal')),
  amount numeric not null default 0,
  frequency text not null default 'monthly' check (frequency in ('weekly', 'biweekly', 'monthly', 'yearly')),
  canceling boolean not null default false,
  notes text,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.kpi_slots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rent numeric not null default 0,
  plan_2027 numeric,
  plan_note text,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.kpi_clients (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid references public.kpi_slots(id) on delete set null,
  name text not null,
  monthly numeric not null default 0,
  paid_amount numeric,
  paid_weeks int,
  expires_on date,
  renewal_offer numeric,
  notes text,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.kpi_payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.kpi_clients(id) on delete set null,
  name text not null default '',
  amount numeric not null default 0,
  paid_on date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);
do $$ declare t text; begin
  foreach t in array array['kpi_expenses', 'kpi_slots', 'kpi_clients', 'kpi_payments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "coach only" on public.%I', t);
    execute format('create policy "coach only" on public.%I for all using (public.is_coach()) with check (public.is_coach())', t);
  end loop;
end $$;
