-- Chat upgrades (October 29 feedback): edit, reply, voice notes. Safe to run more than once.

alter table public.messages add column if not exists edited_at timestamptz;
alter table public.messages add column if not exists reply_to uuid references public.messages (id) on delete set null;
-- What the attachment is: a photo or a voice note (older messages with an attachment are photos).
alter table public.messages add column if not exists attachment_kind text check (attachment_kind in ('image', 'audio'));
alter table public.messages add column if not exists audio_seconds int;

-- Only the person who sent a message can change its words (and only its words). The other side can still
-- mark it read or ♥ it. This replaces the older rule that froze every message's words.
create or replace function public.messages_only_read_at() returns trigger language plpgsql as $$
begin
  new.client_id := old.client_id; new.sender_id := old.sender_id; new.created_at := old.created_at;
  new.attachment_path := old.attachment_path; new.attachment_kind := old.attachment_kind; new.audio_seconds := old.audio_seconds;
  new.reply_to := old.reply_to;
  if auth.uid() is distinct from old.sender_id then
    new.body := old.body; new.edited_at := old.edited_at;
  end if;
  return new;
end $$;
drop trigger if exists messages_only_read_at on public.messages;
create trigger messages_only_read_at before update on public.messages for each row execute function public.messages_only_read_at();
drop trigger if exists protect_message_body on public.messages;
drop function if exists public.protect_message_body();

select 'ok' as chat_upgrades;
