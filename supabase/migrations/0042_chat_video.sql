-- November 13: Michael's video replies (his Blueprint reply) go in her chat, so chat messages can hold a video.
alter table public.messages drop constraint if exists messages_attachment_kind_check;
alter table public.messages add constraint messages_attachment_kind_check check (attachment_kind in ('image', 'audio', 'video'));
