-- Weekly check-ins and the coach dashboard (docs 26 and 28).
-- Safe to run more than once.

-- Michael's notes on each client (onboarding call, what works for her). Fed into the AI reply draft.
alter table public.profiles add column if not exists coach_notes text;

-- Flags computed when she submits (sleep dropping, hunger 8+, "see a professional" words).
alter table public.checkins add column if not exists flags text[] not null default '{}';
alter table public.checkins add column if not exists on_time boolean not null default true;

-- Michael's reply: text and/or a video file he uploads.
alter table public.checkin_replies add column if not exists video_path text;
alter table public.checkin_replies add column if not exists updated_at timestamptz not null default now();

-- She can read Michael's reply once it's sent (policy already exists); only the coach writes replies.

-- Private storage for check-in videos (hers) and reply videos (Michael's).
-- Files live at checkin-videos/<client_id>/<file>, so she can see only her own folder.
insert into storage.buckets (id, name, public) values ('checkin-videos', 'checkin-videos', false)
on conflict (id) do nothing;

drop policy if exists "own checkin videos read" on storage.objects;
drop policy if exists "own checkin videos write" on storage.objects;
drop policy if exists "coach checkin videos write" on storage.objects;
create policy "own checkin videos read" on storage.objects for select
  using (bucket_id = 'checkin-videos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_coach()));
create policy "own checkin videos write" on storage.objects for insert
  with check (bucket_id = 'checkin-videos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_coach()));
create policy "coach checkin videos write" on storage.objects for update
  using (bucket_id = 'checkin-videos' and public.is_coach());

-- Privacy fix: clients could read every column of every profile (weights, notes) through the
-- "community names" policy. Replace it with a names-only view for the community feed.
drop policy if exists "community names" on public.profiles;
create or replace view public.member_names with (security_invoker = false) as
  select id, full_name from public.profiles;
grant select on public.member_names to authenticated;

-- Security: a client can edit her own profile, but never her role, plan, start date or coach notes.
create or replace function public.protect_profile_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_coach() and auth.uid() is not null then
    new.role := old.role;
    new.plan := old.plan;
    new.program_start := old.program_start;
    new.status := old.status;
    new.coach_notes := old.coach_notes;
    new.samcart_order_id := old.samcart_order_id;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile_fields on public.profiles;
create trigger protect_profile_fields before update on public.profiles
  for each row execute function public.protect_profile_fields();
