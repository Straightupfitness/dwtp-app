-- November 15: a 👍 "like" on a chat message, next to the ♥ "love".
alter table public.messages add column if not exists liked_at timestamptz;
