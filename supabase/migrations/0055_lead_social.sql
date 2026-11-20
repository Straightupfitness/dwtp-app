-- November 20 (Michael): message leads on Facebook Messenger (his personal Facebook) or Instagram (the SUFitness account).
-- Her Facebook and Instagram usernames (or profile links), so the buttons can open her chat.
alter table public.leads add column if not exists facebook text;
alter table public.leads add column if not exists instagram text;
select 'ok' as lead_social_ready;
