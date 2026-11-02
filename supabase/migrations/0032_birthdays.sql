-- Birthdays (November 2): her birthday, so Michael's automatic "Happy Birthday {first}" goes out in chat that morning.
-- Safe to run more than once.
alter table public.profiles add column if not exists birthday date;
select 'ok' as birthdays;
