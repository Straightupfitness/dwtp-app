-- Community feed, leaderboard and 1:1 chat with Michael (replaces WhatsApp). Safe to run more than once.

-- Michael can pin a post to the top of the feed (announcements, the Tuesday call link).
alter table public.posts add column if not exists pinned boolean not null default false;
create index if not exists posts_created on public.posts (created_at desc);
create index if not exists comments_post on public.comments (post_id, created_at);

-- She can mark Michael's messages as read; Michael can mark hers.
drop policy if exists "own thread" on public.messages;
drop policy if exists "read own thread" on public.messages;
drop policy if exists "send in own thread" on public.messages;
drop policy if exists "mark read" on public.messages;
drop policy if exists "coach deletes messages" on public.messages;
create policy "read own thread" on public.messages for select using (client_id = auth.uid() or public.is_coach());
create policy "send in own thread" on public.messages for insert
  with check (sender_id = auth.uid() and (client_id = auth.uid() or public.is_coach()));
create policy "mark read" on public.messages for update
  using (client_id = auth.uid() or public.is_coach()) with check (client_id = auth.uid() or public.is_coach());
create policy "coach deletes messages" on public.messages for delete using (public.is_coach());

-- All-time leaderboard (the weekly one exists already). Clients only, active ones.
create or replace view public.leaderboard_all_time with (security_invoker = false) as
  select p.id as client_id, p.full_name, coalesce(sum(l.points), 0)::int as cps
  from public.profiles p
  left join public.cp_ledger l on l.client_id = p.id
  where p.role = 'client' and p.status = 'active'
  group by p.id, p.full_name;
grant select on public.leaderboard_this_week, public.leaderboard_all_time to authenticated;

-- Live updates in the app.
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['posts', 'comments', 'likes', 'messages'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- Photos in posts and chat. media/posts/<user>/<file>: every member can see them.
-- media/chat/<client>/<file>: only that client and Michael.
insert into storage.buckets (id, name, public) values ('media', 'media', false) on conflict (id) do nothing;
drop policy if exists "media read" on storage.objects;
drop policy if exists "media write" on storage.objects;
create policy "media read" on storage.objects for select using (
  bucket_id = 'media' and auth.uid() is not null and (
    (storage.foldername(name))[1] = 'posts'
    or ((storage.foldername(name))[1] = 'chat' and ((storage.foldername(name))[2] = auth.uid()::text or public.is_coach()))));
create policy "media write" on storage.objects for insert with check (
  bucket_id = 'media' and (
    ((storage.foldername(name))[1] = 'posts' and (storage.foldername(name))[2] = auth.uid()::text)
    or ((storage.foldername(name))[1] = 'chat' and ((storage.foldername(name))[2] = auth.uid()::text or public.is_coach()))));

-- Marking a message read can't change what it says.
create or replace function public.messages_only_read_at() returns trigger language plpgsql as $$
begin
  new.client_id := old.client_id; new.sender_id := old.sender_id; new.body := old.body;
  new.attachment_path := old.attachment_path; new.created_at := old.created_at;
  return new;
end $$;
drop trigger if exists messages_only_read_at on public.messages;
create trigger messages_only_read_at before update on public.messages for each row execute function public.messages_only_read_at();

-- Members can see who the coach is (for "Michael (Coach)" labels). Names and role only.
create or replace view public.member_names with (security_invoker = false) as
  select id, full_name, role from public.profiles;
grant select on public.member_names to authenticated;
