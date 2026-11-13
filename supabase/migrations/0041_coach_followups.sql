-- November 13: Michael's follow-up queue. Per client and topic (e.g. 'blueprint'): the AI's last-48-hours bullets
-- and talking points, and when he marked her done.
create table if not exists public.coach_followups (
  client_id uuid not null references public.profiles(id) on delete cascade,
  topic text not null,
  brief jsonb,
  brief_at timestamptz,
  done_at timestamptz,
  primary key (client_id, topic)
);
alter table public.coach_followups enable row level security;
drop policy if exists "coach only" on public.coach_followups;
create policy "coach only" on public.coach_followups for all using (public.is_coach()) with check (public.is_coach());
