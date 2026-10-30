-- When each client last opened the app (October 29: Michael's "not in the app for 48 hours" filter).
-- Updated at most every 15 minutes while she uses the app. Safe to run more than once.
alter table public.profiles add column if not exists last_seen_at timestamptz;
select 'ok' as last_seen;
