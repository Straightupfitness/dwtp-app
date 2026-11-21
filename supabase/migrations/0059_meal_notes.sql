-- 38 Meal comments (November 20, 2026)
-- A comment she adds to a meal when she logs it (photo, voice or typed): "ate this at my mom's", "so bloated after".
-- Michael sees it on her food logs and the check-in talking points use it.
alter table public.food_logs add column if not exists note text;
