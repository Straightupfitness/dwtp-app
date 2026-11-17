-- November 17 (Michael): more about each lead. Online or in person, the time slot she wants, where he got the lead,
-- how they talk (text, IG DM…), and how hot she is: hot, warm, cold or dead.
alter table public.leads add column if not exists lead_type text check (lead_type in ('online', 'in_person'));
alter table public.leads add column if not exists time_slot text;
alter table public.leads add column if not exists lead_source text;
alter table public.leads add column if not exists contact_method text;
alter table public.leads add column if not exists temperature text check (temperature in ('hot', 'warm', 'cold', 'dead'));
