-- Clients' Trainerize history (October 29): weigh-ins, steps and logged meals, imported once by Michael.
-- import_key marks an imported meal so importing the file again never doubles it. Safe to run more than once.
alter table public.food_logs add column if not exists import_key text;
create unique index if not exists food_logs_import_key on public.food_logs (import_key);

select 'ok' as trainerize_history;
