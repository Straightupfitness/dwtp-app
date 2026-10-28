-- Real Talk Tuesday reminders: Supabase calls the app every 5 minutes on Tuesday afternoon (Pacific),
-- and the app sends a push 60 minutes and 5 minutes before the 4:30 PM call. Safe to run more than once.
-- Two schedules because Pacific time moves between UTC-7 (summer) and UTC-8 (winter):
-- 22:00–23:55 UTC Tuesday and 00:00–00:55 UTC Wednesday cover 3:00–5:55 PM Pacific in both.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  perform cron.unschedule(jobname) from cron.job where jobname in ('rtt-reminders-tue', 'rtt-reminders-wed');
end $$;

select cron.schedule('rtt-reminders-tue', '*/5 22,23 * * 2',
  $$ select net.http_get('https://app.straightupfitness.com/api/cron/rtt') $$);
select cron.schedule('rtt-reminders-wed', '*/5 0 * * 3',
  $$ select net.http_get('https://app.straightupfitness.com/api/cron/rtt') $$);

-- Check: two rows, both active.
select jobname, schedule, active from cron.job where jobname like 'rtt-reminders-%';
