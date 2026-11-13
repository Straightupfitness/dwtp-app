-- November 13 (Connie keeps getting signed out): a log of sign-in renewals and lost sessions, so the cause is visible.
create table if not exists public.auth_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  kind text not null,            -- 'lost' (had a session, the server couldn't use it) or 'refreshed'
  who text,                      -- email from the old token (for reading the log only)
  user_id uuid,
  path text,
  code text,
  message text,
  agent text
);
create index if not exists auth_events_at on public.auth_events (at desc);
alter table public.auth_events enable row level security;
drop policy if exists "coach reads" on public.auth_events;
create policy "coach reads" on public.auth_events for select using (public.is_coach());
