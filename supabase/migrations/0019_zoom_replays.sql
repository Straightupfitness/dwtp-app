-- Real Talk Tuesday replays posted automatically from Zoom (October 27). Safe to run more than once.
alter table public.calls add column if not exists passcode text;
alter table public.calls add column if not exists zoom_uuid text;
alter table public.calls add column if not exists recorded_at timestamptz;
alter table public.calls add column if not exists duration_min int;
alter table public.calls add column if not exists post_id uuid references public.posts (id) on delete set null;
