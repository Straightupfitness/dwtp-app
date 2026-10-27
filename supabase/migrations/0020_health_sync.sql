-- Apple Health sync through an iPhone Shortcut (October 27). Safe to run more than once.
-- Her personal sync code (only a hash is stored). Server only.
create table if not exists public.health_tokens (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
alter table public.health_tokens enable row level security;

-- One row per day: steps and sleep from her phone. She and Michael can read it; only the server writes.
create table if not exists public.health_days (
  client_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  steps int,
  sleep_minutes int,
  source text not null default 'apple-shortcut',
  synced_at timestamptz not null default now(),
  primary key (client_id, day)
);
alter table public.health_days enable row level security;
drop policy if exists "read own health days" on public.health_days;
create policy "read own health days" on public.health_days for select using (client_id = auth.uid() or public.is_coach());
