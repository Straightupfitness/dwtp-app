-- 40 Video captions (November 21, 2026)
-- Captions for Michael's program videos (WebVTT, made from the video's audio with Deepgram). Shown on top of the
-- video in the app. captions_at = when they were made (also set when there was nothing to caption).
alter table public.program_videos add column if not exists captions text;
alter table public.program_videos add column if not exists captions_at timestamptz;
