-- Notifications (push + email) and video check-in transcripts. Safe to run more than once.

-- Her phone/browser push subscriptions. One row per device.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions" on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Email on/off, per person (push is controlled by the phone itself).
alter table public.profiles add column if not exists email_notifications boolean not null default true;

-- What was sent, so a reminder never goes out twice (key like 'checkin-open:12').
create table if not exists public.notification_log (
  user_id uuid not null references public.profiles (id) on delete cascade,
  key text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.notification_log enable row level security;  -- server only

-- App settings only the server can read (the push signing keys are generated here on first use).
create table if not exists public.app_config (key text primary key, value text not null);
alter table public.app_config enable row level security;  -- no policies: server only

-- Video check-ins: transcript status.
alter table public.checkins add column if not exists transcript_status text
  check (transcript_status in ('pending', 'done', 'failed'));
