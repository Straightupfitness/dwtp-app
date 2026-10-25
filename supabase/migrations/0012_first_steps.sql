-- "Do this first" on Today: when she added the app to her Home Screen.
alter table public.profiles add column if not exists home_screen_at timestamptz;

-- Medal names (October 25).
update public.rings set name = 'Log Your Numbers'
  where name = 'Log It' and circle_id = (select id from public.circles where slug = 'food-philosophy');
update public.rings set name = 'Get Started'
  where name = 'First Sessions' and circle_id = (select id from public.circles where slug = 'strength');
