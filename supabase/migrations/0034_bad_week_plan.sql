-- The Bad Week Plan (November 6): when life wins a week, she switches to just three things. Up to 3 across the 26 weeks.
-- A bad week counts as complete for the 15 Pound Guarantee's 80% (habits and check-ins). Safe to run more than once.

create table if not exists public.bad_weeks (
  client_id uuid not null references public.profiles (id) on delete cascade,
  week_number int not null,
  source text not null default 'today' check (source in ('today', 'checkin', 'coach')),
  created_at timestamptz not null default now(),
  primary key (client_id, week_number)
);
alter table public.bad_weeks enable row level security;
drop policy if exists "own bad weeks" on public.bad_weeks;
create policy "own bad weeks" on public.bad_weeks for all using (client_id = auth.uid() or public.is_coach())
  with check (client_id = auth.uid() or public.is_coach());

-- At most 3 per client, enforced here too.
create or replace function public.bad_weeks_cap() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.bad_weeks where client_id = new.client_id) >= 3 then
    raise exception 'You have used all 3 bad weeks';
  end if;
  return new;
end $$;
drop trigger if exists bad_weeks_cap on public.bad_weeks;
create trigger bad_weeks_cap before insert on public.bad_weeks for each row execute function public.bad_weeks_cap();

-- The lesson: a bonus in Week 2 (opens with Week 2's Habits & Homework).
insert into public.lessons (id, kind, number, title, video_url, body, quiz, quiz_status, week_number, retired)
values ('6b1f3c2e-7d4a-4e8b-9c55-0b2d9a5e1f01', 'other', 1, 'The Bad Week Plan', null,
'When life wins a week, tap "Having a bad week?" on your Today screen (or say so in your check-in).

Do just these three things:
1. Get outside within 30 minutes of waking (even 2 minutes counts)
2. 40 g+ protein at breakfast
3. A 10-minute walk

Everything else pauses: workouts, food logging, lessons. No guilt. No catching up.

The rules
• A bad week still counts toward your 80%
• You get up to 3 bad weeks across the 26 weeks
• No explanation needed
• After a bad week, you pick up where you left off

You can ease off without falling off.',
'[{"q":"What do you do when you''re having a bad week?","options":["Say \"I failed this week\"","Tap \"Having a bad week?\" (or say \"bad week\" in your check-in)","Nothing, just skip it","Write a long explanation"],"correct":1},
  {"q":"Which three things do you still do in a bad week?","options":["Full workout, food log, lesson","Light outside within 30 minutes of waking, 40 g+ protein at breakfast, a 10-minute walk","Fast until noon, cold shower, 10,000 steps","Nothing at all"],"correct":1},
  {"q":"How many bad weeks can you use across the 26 weeks, and do they count toward your 80%?","options":["Unlimited, and they don''t count","1, and it doesn''t count","Up to 3, and they count toward your 80%","Up to 10, and they count double"],"correct":2}]'::jsonb,
'approved', 2, false)
on conflict (id) do update set title = excluded.title, body = excluded.body, quiz = excluded.quiz, quiz_status = excluded.quiz_status, week_number = excluded.week_number;

select 'ok' as bad_week_plan;
