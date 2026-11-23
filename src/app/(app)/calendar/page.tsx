import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadCalendar, type CalEvent } from "@/lib/calendar";
import ScrollToToday from "./ScrollToToday";
import WorkoutDays from "./WorkoutDays";

const display = "font-[family-name:var(--font-display)] uppercase";
const COLOR: Record<CalEvent["kind"], string> = {
  week: "#f5a623", workout: "#f5a623", call: "#38bdf8", sbw: "#22c55e", smf: "#c084fc", checkin: "#ffcc75", medal: "#818cf8", break: "#7ee2a8",
};
const fmtDay = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
const fmtShort = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { today, start, weeks, workoutDays, perWeek } = await loadCalendar(supabase, user!.id);

  // November 23 (Michael): one long list of days she scrolls up and down, a week banner between each Sunday and
  // Monday, and it opens on today.
  return (
    <section className="space-y-3.5">
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Your workouts, lessons and calls</p>
        <h1 className={`${display} mt-1 text-[30px] font-semibold`}>Calendar</h1>
      </header>
      {start && <WorkoutDays initial={workoutDays} perWeek={perWeek} />}
      <ScrollToToday />

      {weeks.map(({ monday, week, days }) => {
        const wk = days[0].events.find((e) => e.kind === "week");
        const label = start && week >= 1 && week <= 26 ? `Week ${week}` : start && days[6].date < start ? "Before you start" : week > 26 ? "After week 26" : "This week";
        const banner = (
          <>
            <span className="min-w-0 flex-1">
              <span className={`${display} block text-[22px] leading-none text-accent`}>{label}</span>
              <span className="mt-1 block text-[12px] text-dim">{fmtShort(days[0].date)} – {fmtShort(days[6].date)}{wk?.detail ? ` · ${wk.locked ? "Locked · " : ""}${wk.detail}` : ""}</span>
            </span>
            {wk?.href && !wk.locked && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="2" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>}
          </>
        );
        const bcls = "flex items-center gap-3 rounded-2xl border border-[#3a2a0a] bg-[#1a1306] px-3.5 py-3";
        return (
          <div key={monday} className="space-y-2">
            {wk?.href && !wk.locked ? <Link href={wk.href} className={bcls}>{banner}</Link> : <div className={bcls}>{banner}</div>}
      <ol className="space-y-2">
        {days.map((d) => {
          const isToday = d.date === today, past = d.date < today;
          return (
            <li key={d.date} id={isToday ? "today" : undefined} className={`scroll-mt-24 rounded-2xl border bg-card p-3 ${isToday ? "border-accent" : "border-border"} ${past ? "opacity-80" : ""}`}>
              <p className={`text-[12px] font-semibold uppercase tracking-[0.1em] ${isToday ? "text-accent" : "text-dim"}`}>{isToday ? "Today · " : ""}{fmtDay(d.date)}</p>
              {d.events.some((e) => e.kind !== "week") ? (
                <ul className="mt-1.5 space-y-1">
                  {d.events.filter((e) => e.kind !== "week").map((e, i) => {
                    const c = e.color ?? COLOR[e.kind];
                    const body = (
                      <>
                        <span className="mt-1 h-8 w-1 shrink-0 rounded-full" style={{ background: c }} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-medium">{e.title}{e.time && <span className="font-normal text-dim"> · {e.time}</span>}</span>
                          {e.detail && <span className="block text-[13px] text-[#a8a8a8]">{e.locked ? <span className="text-dim">Locked · </span> : null}{e.detail}</span>}
                        </span>
                        {e.href && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="2" aria-hidden="true" className="mt-1.5 shrink-0"><path d={e.external ? "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" : "M9 6l6 6-6 6"} /></svg>}
                      </>
                    );
                    const cls = "flex min-h-11 items-start gap-2.5 rounded-lg py-1";
                    return <li key={i}>{e.href
                      ? e.external ? <a href={e.href} target="_blank" rel="noopener noreferrer" className={cls}>{body}</a> : <Link href={e.href} className={cls}>{body}</Link>
                      : <div className={cls}>{body}</div>}</li>;
                  })}
                </ul>
              ) : <p className="mt-1 text-[13px] text-dim">Your daily habits, food and weigh-in.</p>}
              {/* November 3: today and past days open "fill in this day" (weight, steps, food, water). */}
              {d.date <= today && (
                <Link href={`/log?d=${d.date}`} className="mt-1.5 flex min-h-10 items-center justify-between rounded-lg border border-dashed border-[#3a3a3a] px-3 text-[13px]">
                  <span>{isToday ? "Log today's weight, steps and water" : "Add or fix this day's weight, steps, food and water"}</span><span className="text-accent">›</span>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
          </div>
        );
      })}
      <p className="text-xs text-dim">Every day: check off your habits, log your food and weigh in. Times are in your time zone.</p>
    </section>
  );
}
