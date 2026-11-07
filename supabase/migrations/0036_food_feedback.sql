-- November 7: daily food feedback. Michael's short note on one day of her food log: an AI draft he edits,
-- then sends in the app chat or by text. One row per client per day. Coach only.
create table if not exists public.food_feedback (
  client_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  draft text,
  sent_text text,
  sent_via text check (sent_via in ('chat', 'text', 'skipped')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (client_id, day)
);
alter table public.food_feedback enable row level security;
drop policy if exists "coach manages food feedback" on public.food_feedback;
create policy "coach manages food feedback" on public.food_feedback for all using (public.is_coach()) with check (public.is_coach());
create index if not exists food_feedback_day on public.food_feedback (day);
