-- Medals (October 23): the program text clients see says "medal", not "ring". Safe to run more than once.
-- Gymnastic rings stay rings ("L-sit on rings").
create or replace function pg_temp.medal(t text) returns text language sql immutable as $$
  select regexp_replace(regexp_replace(regexp_replace(regexp_replace(t,
    '\mRings\M', 'Medals', 'g'), '(?<!on )\mrings\M', 'medals', 'g'), '\mRing\M', 'Medal', 'g'), '\mring\M', 'medal', 'g');
$$;
update public.ring_items set title = pg_temp.medal(title), detail = pg_temp.medal(detail)
  where title ~* '(?<!on )\mrings?\M' or detail ~* '(?<!on )\mrings?\M';
update public.rings set outcome = pg_temp.medal(outcome) where outcome ~* '\mrings?\M';
update public.circles set goal = pg_temp.medal(goal), see_a_professional = pg_temp.medal(see_a_professional)
  where goal ~* '\mrings?\M' or see_a_professional ~* '\mrings?\M';
-- Check: should return 0.
select count(*) as still_says_ring from public.ring_items where title ~* '(?<!on )\mrings?\M' or detail ~* '(?<!on )\mrings?\M';
