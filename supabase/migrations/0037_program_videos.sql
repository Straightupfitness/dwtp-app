-- November 9: Michael's program videos (onboarding, Driven Woman Blueprint, check-ins, medals, later H&H/SBW/FAQ).
-- One file per code (ONB-01, 7X-05, CHK-02, MED-14 …) in a public bucket; he uploads them from Coach → Videos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('program-videos', 'program-videos', true, 104857600, array['video/mp4', 'video/quicktime', 'image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 104857600, allowed_mime_types = array['video/mp4', 'video/quicktime', 'image/jpeg'];

drop policy if exists "program videos readable" on storage.objects;
create policy "program videos readable" on storage.objects for select using (bucket_id = 'program-videos');
drop policy if exists "coach uploads program videos" on storage.objects;
create policy "coach uploads program videos" on storage.objects for insert with check (bucket_id = 'program-videos' and public.is_coach());
drop policy if exists "coach updates program videos" on storage.objects;
create policy "coach updates program videos" on storage.objects for update using (bucket_id = 'program-videos' and public.is_coach());
drop policy if exists "coach removes program videos" on storage.objects;
create policy "coach removes program videos" on storage.objects for delete using (bucket_id = 'program-videos' and public.is_coach());

create table if not exists public.program_videos (
  code text primary key check (code ~ '^[A-Z0-9]+-[0-9]+$'),
  path text not null,
  portrait boolean,
  seconds numeric,
  bytes bigint,
  uploaded_at timestamptz not null default now()
);
alter table public.program_videos enable row level security;
drop policy if exists "everyone reads program videos" on public.program_videos;
create policy "everyone reads program videos" on public.program_videos for select using (auth.uid() is not null);
drop policy if exists "coach manages program videos" on public.program_videos;
create policy "coach manages program videos" on public.program_videos for all using (public.is_coach()) with check (public.is_coach());
