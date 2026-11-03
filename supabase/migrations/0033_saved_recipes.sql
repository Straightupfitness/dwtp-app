-- Saved recipes (November 2): she taps ♥ on a recipe to keep it for another time. Safe to run more than once.
-- (Michael's client birthday list went into the same file he ran, kept out of the repo because it's client data.)
create table if not exists public.recipe_favorites (
  client_id uuid not null references public.profiles (id) on delete cascade,
  recipe_id bigint not null references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, recipe_id)
);
alter table public.recipe_favorites enable row level security;
drop policy if exists "own saved recipes" on public.recipe_favorites;
create policy "own saved recipes" on public.recipe_favorites for all using (client_id = auth.uid() or public.is_coach()) with check (client_id = auth.uid());
select 'ok' as saved_recipes;
