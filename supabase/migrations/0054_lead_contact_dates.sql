-- November 19 (Michael): on his Leads tab, the last day she reached out to him and the last day he reached out to her.
-- He sets them with a tap; texting a lead from the app fills in "I reached out" for that day by itself.
alter table public.leads add column if not exists last_heard_on date;
alter table public.leads add column if not exists last_reached_on date;
select 'ok' as lead_dates_ready;
