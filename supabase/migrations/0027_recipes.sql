-- Recipes (October 29): Michael's recipes and the recipe library, brought over from Trainerize.
-- Clients browse them in Food → Recipes and log one with a tap. Safe to run more than once.
-- The recipes themselves are imported on Coach → Clips & recipe media (Import recipes).

create table if not exists public.recipes (
  id bigint primary key,                 -- Trainerize meal id
  name text not null,
  mine boolean not null default false,   -- Michael's own (his "DRIVEN" recipes) vs the library
  sort int not null default 0,
  meal_types text[] not null default '{}',   -- breakfast · lunch · dinner · snacks
  tags text[] not null default '{}',         -- simpleMeals · highFiber · noCooking · onePot · paleo · salad · smoothie …
  description text,
  prep_min int, cook_min int,
  servings numeric not null default 1,   -- the ingredients make this many servings
  calories numeric, protein_g numeric, carbs_g numeric, fat_g numeric, fiber_g numeric, potassium_mg numeric,  -- per serving
  ingredients jsonb not null default '[]',   -- [{name, amount, unit}] for the whole recipe
  steps text[] not null default '{}',
  has_photo boolean not null default false,  -- exercise-clips/recipes/<id>.jpg
  has_video boolean not null default false,  -- exercise-clips/recipes/<id>.mp4
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create index if not exists recipes_sort on public.recipes (mine desc, sort);
alter table public.recipes enable row level security;
drop policy if exists "read" on public.recipes;
create policy "read" on public.recipes for select using (auth.uid() is not null);
drop policy if exists "coach writes" on public.recipes;
create policy "coach writes" on public.recipes for all using (public.is_coach()) with check (public.is_coach());

-- A meal logged from a recipe.
alter table public.food_logs drop constraint if exists food_logs_source_check;
alter table public.food_logs add constraint food_logs_source_check check (source in ('photo', 'voice', 'text', 'saved_meal', 'recipe'));
alter table public.food_logs add column if not exists recipe_id bigint references public.recipes (id) on delete set null;

select 'ok' as recipes;
