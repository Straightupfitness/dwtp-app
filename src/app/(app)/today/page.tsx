import Link from "next/link";
import CpCount from "@/components/CpCount";
import { createClient } from "@/lib/supabase/server";
import { loadProgram, type ItemState } from "@/lib/circles";
import { journey, todayIn } from "@/lib/program";
import StageBars, { JOURNEY_WEEKS, journeyWeek } from "@/components/JourneyBar";
import { currentWindow, DEADLINE_TZ } from "@/lib/checkin";
import { DAILY_TARGETS } from "@/lib/food";
import NotificationSettings from "@/components/NotificationSettings";
import DoThisFirst from "@/components/DoThisFirst";
import { IconCheckin, IconDumbbell, IconHabits, IconLessons } from "@/components/Icons";
import { loadWorkoutWeek } from "@/lib/workouts";
import { threshold } from "@/lib/health-parse";
import ItemCheck from "../circles/ItemCheck";
import LessonRow from "../lessons/LessonRow";
import { loadLessons } from "@/lib/lessons";
import QuickStats from "./QuickStats";

const display = "font-[family-name:var(--font-display)] uppercase";
const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);

function greeting(tz: string) {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
function timeLeft(until: Date) {
  const mins = Math.max(0, Math.round((until.getTime() - Date.now()) / 60_000));
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60);
  return d ? `${d} day${d > 1 ? "s" : ""} ${h} hrs left` : h ? `${h} hrs left` : `${mins} min left`;
}

function SectionTitle({ icon, children, as = "p" }: { icon: React.ReactNode; children: React.ReactNode; as?: "p" | "h2" }) {
  const Tag = as;
  return <Tag className={`${display} flex items-center gap-1.5 text-lg font-medium`}><span className="text-accent">{icon}</span>{children}</Tag>;
}

export default async function TodayPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profile }, state] = await Promise.all([
    supabase.from("profiles").select("full_name, timezone, home_screen_at, avatar_path").eq("id", user!.id).single(),
    loadProgram(supabase, user!.id),
  ]);
  const { today, week } = state;
  const tz = profile?.timezone ?? "America/Los_Angeles";
  const first = profile?.full_name?.split(" ")[0];
  const { data: cps } = await supabase.from("cp_totals").select("total, this_week").eq("client_id", user!.id).maybeSingle();
  const j = journey(state.programStart, today);
  const jw = j ? journeyWeek(j.day, j.startsIn) : 0;
  const date = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" }).format(new Date());
  const pts = cps?.total ?? 0, wk = cps?.this_week ?? 0;
  const top = (
    <header className="space-y-2">
      <div>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">{date}</p>
        <h1 className={`${display} mt-0.5 text-[30px] font-semibold leading-tight`}>{greeting(tz)}{first ? ` ${first}` : ""}</h1>
      </div>
      <div className="space-y-3 rounded-[18px] border border-border bg-card px-4 pb-3 pt-3">
        <div className="flex items-baseline justify-between gap-3 text-[13px]">
          {j && j.startsIn > 0
            ? <p>Your program starts <b>{j.startsIn === 1 ? "tomorrow" : `in ${j.startsIn} days`}</b></p>
            : <p>You have <b className="text-gold"><CpCount total={pts} /></b> <span className="text-[#7ee2a8]">(+{wk} this week)</span></p>}
          <p className="shrink-0 font-semibold tabular-nums">
            {jw < 1 ? `${JOURNEY_WEEKS} weeks ahead` : jw > JOURNEY_WEEKS ? `Week ${jw}` : <>Week {jw} <span className="text-dim">of {JOURNEY_WEEKS}</span></>}
          </p>
        </div>
        <StageBars week={jw} />
      </div>
    </header>
  );

  if (week === 0) {
    return (
      <section className="space-y-4">
        {top}
        <p className="text-[15px] leading-relaxed text-[#a8a8a8]">
          Your program starts on <b className="text-text">{state.programStart
            ? new Date(state.programStart + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })
            : "your first Monday"}</b>. Your workouts and your first habits go live that morning.
        </p>
        <DoThisFirst userId={user!.id} name={profile?.full_name ?? null} homeDone={!!profile?.home_screen_at} avatarPath={profile?.avatar_path ?? null} />
        <NotificationSettings />
        <Link href="/faq" className="flex min-h-12 items-center justify-center rounded-xl border border-border text-sm font-semibold">Browse the FAQ while you wait</Link>
      </section>
    );
  }

  const { open } = currentWindow(state.programStart);
  const [{ data: tw }, { data: weights }, { data: meals }, { data: target }, { data: done }] = await Promise.all([
    supabase.from("trajectory_weeks").select("phase, is_diet_break").eq("week_number", Math.min(week, 52)).maybeSingle(),
    supabase.from("weight_logs").select("log_date, weight_lbs").eq("client_id", user!.id).gte("log_date", addDays(today, -14)).order("log_date"),
    supabase.from("food_logs").select("eaten_at, calories, protein_g").eq("client_id", user!.id).gte("eaten_at", addDays(today, -1) + "T00:00:00Z"),
    supabase.from("nutrition_targets").select("calorie_target, protein_g").eq("client_id", user!.id).maybeSingle(),
    open ? supabase.from("checkins").select("id").eq("client_id", user!.id).eq("week_number", open.week).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const lessonWeek = (await loadLessons(supabase, user!.id)).weeks.find((w) => w.week === week);
  const yesterday = addDays(today, -1);
  const workouts = await loadWorkoutWeek(supabase, user!.id);
  const { data: hdays } = await supabase.from("health_days").select("day, steps").eq("client_id", user!.id).in("day", [today, yesterday]);
  const stepsToday = hdays?.find((h) => h.day === today)?.steps ?? null;
  const stepsYesterday = hdays?.find((h) => h.day === yesterday)?.steps ?? null;
  // Her step goal right now: the biggest "Walk N steps a day" habit in her open medals.
  const stepGoal = Math.max(0, ...state.circles.flatMap((c) => c.rings.filter((r) => r.status === "open").flatMap((r) => r.items))
    .map((i) => threshold(i.title)).filter((t) => t?.kind === "steps").map((t) => t!.min)) || null;
  const todayMeals = (meals ?? []).filter((m) => todayIn(tz, new Date(m.eaten_at)) === today);
  const kcal = todayMeals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const protein = Math.round(todayMeals.reduce((s, m) => s + Number(m.protein_g ?? 0), 0));
  const proteinTarget = target?.protein_g ?? DAILY_TARGETS.protein_g;
  const kcalTarget = target?.calorie_target ?? null;
  const w = weights ?? [];
  const weightToday = w.find((x) => x.log_date === today);
  const change = w.length >= 2 ? Number(w[w.length - 1].weight_lbs) - Number(w[0].weight_lbs) : null;

  // Every daily and weekly habit from her open medals; a habit that lives in two circles shows once.
  const seen = new Set<string>();
  const circleGroups: { name: string; color: string; items: (ItemState & { medal: string })[] }[] = [];
  for (const c of state.circles) {
    for (const r of c.rings) {
      if (r.status !== "open") continue;
      const its = r.items.filter((i) => ["do", "eat", "take"].includes(i.type) && i.cadence !== "once")
        .filter((i) => { const k = i.habitKey ?? i.id; if (seen.has(k)) return false; seen.add(k); return true; })
        .sort((a, b) => (a.cadence === "daily" ? 0 : 1) - (b.cadence === "daily" ? 0 : 1));
      if (!its.length) continue;
      let cg = circleGroups.find((x) => x.name === c.name);
      if (!cg) { cg = { name: c.name, color: c.color, items: [] }; circleGroups.push(cg); }
      cg.items.push(...its.map((i) => ({ ...i, medal: r.name })));
    }
  }
  const all = circleGroups.flatMap((g) => g.items);
  const doneCount = all.filter((i) => i.doneNow).length;

  return (
    <section className="space-y-3.5">
      {top}
      {tw?.is_diet_break && <p className="text-[13px] text-[#a8a8a8]">Diet break week: eat at maintenance.</p>}

      {open && !done && (
        <Link href="/checkin" className="flex items-center gap-3 rounded-2xl border border-accent bg-[#1f1708] p-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-black"><IconCheckin /></span>
          <span className="flex-1">
            <span className="block text-[15px] font-semibold">Your Week {open.week} check-in is open</span>
            <span className="block text-xs text-[#c9b48a]">
              Closes {new Intl.DateTimeFormat("en-US", { timeZone: DEADLINE_TZ, weekday: "short", hour: "numeric" }).format(open.closes)} · {timeLeft(open.closes)} · +10 CPs
            </span>
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f5a623" strokeWidth="2" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </Link>
      )}

      {profile?.home_screen_at && profile.avatar_path
        ? <NotificationSettings compact />
        : <DoThisFirst userId={user!.id} name={profile?.full_name ?? null} homeDone={!!profile?.home_screen_at} avatarPath={profile?.avatar_path ?? null} />}

      {workouts.phase && (
        <Link href={workouts.nextUp ? `/workouts/${workouts.nextUp.id}` : "/workouts"} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5">
          <span className="relative block size-[68px] shrink-0 overflow-hidden rounded-xl bg-[#1b1b1b]">
            {/* eslint-disable-next-line @next/next/no-img-element -- storage poster */}
            {(workouts.nextUp ?? workouts.strength[0])?.poster && <img src={(workouts.nextUp ?? workouts.strength[0])!.poster!} alt="" className={`size-full object-cover ${workouts.nextUp ? "" : "opacity-40"}`} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className={`${display} flex items-center gap-1.5 text-lg font-medium`}><span className="text-accent"><IconDumbbell /></span>{workouts.nextUp ? "Your next workout" : "Workouts"}</span>
            <span className="block text-[13px] text-[#a8a8a8]">
              {workouts.nextUp
                ? `${workouts.nextUp.title}${workouts.nextUp.minutes ? ` · about ${workouts.nextUp.minutes} min` : ""} · ${workouts.strength.filter((x) => x.done).length} of ${workouts.strength.length} done this week`
                : `All ${workouts.strength.length} done this week. Cardio menu is open.`}
            </span>
          </span>
          <span className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold ${workouts.nextUp ? "bg-accent text-black" : "border border-[#2f2f2f]"}`}>{workouts.nextUp?.started ? "Continue" : workouts.nextUp ? "Start" : "Open"}</span>
        </Link>
      )}

      <QuickStats today={today} yesterday={yesterday}
        weight={weightToday ? Number(weightToday.weight_lbs) : null} spark={w.map((x) => Number(x.weight_lbs))} change={change}
        kcal={kcal} kcalTarget={kcalTarget} protein={protein} proteinTarget={proteinTarget}
        steps={stepsToday} stepsYesterday={stepsYesterday} stepGoal={stepGoal} />

      {all.length > 0 && (
        <>
          <div className="flex items-center justify-between pt-1">
            <SectionTitle icon={<IconHabits />} as="h2">Today&apos;s habits</SectionTitle>
            <p className="text-[13px] text-[#a8a8a8]"><b className="text-text">{doneCount}</b> of {all.length} done</p>
          </div>
          <div className="-mt-1.5 h-1.5 rounded-full bg-[#262626]"><div className="h-1.5 rounded-full bg-accent" style={{ width: `${Math.round((doneCount / all.length) * 100)}%` }} /></div>
        </>
      )}

      {circleGroups.length > 0 && (
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          {circleGroups.map((cg) => {
            const done = cg.items.filter((i) => i.doneNow).length, all = done === cg.items.length;
            return (
              <details key={cg.name} className="group px-3.5">
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular-nums"
                    style={all ? { background: cg.color } : { border: `2px solid ${cg.color}`, color: cg.color }}
                    aria-label={`${done} of ${cg.items.length} done`}>
                    {!all && `${done}/${cg.items.length}`}
                    {all && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>}
                  </span>
                  <span className={`${display} flex-1 text-[17px]`} style={{ color: cg.color }}>{cg.name}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="2" aria-hidden="true" className="shrink-0 transition group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
                </summary>
                <div className="mb-2 ml-11 divide-y divide-border border-t border-border">
                  {cg.items.map((it) => (
                    <ItemCheck key={it.id} itemId={it.id} done={it.doneNow} complete={it.complete} title={it.title} detail={it.detail} eyebrow={it.medal}
                      progress={it.progress} target={it.target} cadence={it.cadence} color={cg.color} auto={it.auto} alsoIn={it.alsoIn} />
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      )}
      {!circleGroups.length && <p className="text-dim">No habits open yet. Your next medal opens soon.</p>}

      {lessonWeek && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between pt-1">
            <SectionTitle icon={<IconLessons />} as="h2">This week&apos;s lessons</SectionTitle>
            <Link href="/lessons" className="text-[13px] text-accent">All lessons</Link>
          </div>
          <div className="divide-y divide-border rounded-2xl border border-border bg-card">
            {lessonWeek.lessons.map((l) => <LessonRow key={l.id} l={l} />)}
          </div>
        </div>
      )}
    </section>
  );
}
