-- One-tap welcome links: Michael adds a client and she gets one email with a personal link.
-- Only a hash of the link is stored. Server only (no policies).
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists invites_user on public.invites (user_id);
alter table public.invites enable row level security;
