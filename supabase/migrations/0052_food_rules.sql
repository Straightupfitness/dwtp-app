-- November 18 (Heather): her food rules ("never pork", "gluten-free"…), so the AI never guesses a food she doesn't eat.
alter table public.profiles add column if not exists food_rules text;
