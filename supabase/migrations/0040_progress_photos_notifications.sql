-- November 11: progress photos, and a list of her notifications (so the red number on the app icon means something).

-- 1. Progress photos: before / after / any day, front, side or back. Files live at progress-photos/<client_id>/<file>.jpg
insert into storage.buckets (id, name, public) values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

drop policy if exists "own progress photos read" on storage.objects;
create policy "own progress photos read" on storage.objects for select
  using (bucket_id = 'progress-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_coach()));
drop policy if exists "own progress photos write" on storage.objects;
create policy "own progress photos write" on storage.objects for insert
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own progress photos delete" on storage.objects;
create policy "own progress photos delete" on storage.objects for delete
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  taken_on date not null,
  pose text not null default 'front' check (pose in ('front', 'side', 'back', 'other')),
  path text not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists progress_photos_client on public.progress_photos (client_id, taken_on);
alter table public.progress_photos enable row level security;
drop policy if exists "own rows" on public.progress_photos;
create policy "own rows" on public.progress_photos for all
  using (client_id = auth.uid() or public.is_coach()) with check (client_id = auth.uid() or public.is_coach());

-- 2. Her notifications: every push or email the app sends her is also kept here, to read in the app.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null default '',
  url text not null default '/today',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "own notifications read" on public.notifications;
create policy "own notifications read" on public.notifications for select using (user_id = auth.uid());
drop policy if exists "own notifications update" on public.notifications;
create policy "own notifications update" on public.notifications for update using (user_id = auth.uid());
