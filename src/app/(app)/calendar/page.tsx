import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadWeek, type CalEvent } from "@/lib/calendar";
import WorkoutDays from "./WorkoutDays";
import BackButton from "@/components/BackButton";

const display = "font-[family-name:var(--font-display)] uppercase";
const COLOR: Record<CalEvent["kind"], string> = {
  week: "#f5a623", workout: "#f5a623", call: "#38bdf8", sbw: "#22c55e", smf: "#c084fc", checkin: "#ffcc75", medal: "#818cf8", break: "#7ee2a8",
};
const fmtDay = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
const fmtShort = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const offset = Math.max(-30, Math.min(30, Number((await searchParams).w) || 0));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { today, days, week, start, workoutDays } = await loadWeek(supabase, user!.id, offset);
  const nav = "grid size-11 place-items-center rounded-full border border-[#2a2a2a]";

  return (
    <section className="space-y-3.5">
      <BackButton fallback="/today" />
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Your week at a glance</p>
        <h1 className={`${display} mt-1 text-[30px] font-semibold`}>Calendar</h1>
      </header>

      <div className="flex items-center justify-between gap-2">
        <Link href={`/calendar?w=${offset - 1}`} className={nav} aria-label="Previous week">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </Link>
        <div className="text-center">
          <p className={`${display} text-[19px]`}>{week >= 1 && week <= 26 ? `Week ${week}` : start && days[6].date < start ? "Before you start" : "This week"}</p>
          <p className="text-xs text-dim">{fmtShort(days[0].date)} – {fmtShort(days[6].date)}{offset !== 0 && <> · <Link href="/calendar" className="text-accent">Back to this week</Link></>}</p>
        </div>
        <Link href={`/calendar?w=${offset + 1}`} className={nav} aria-label="Next week">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </Link>
      </div>

      <ol className="space-y-2">
        {days.map((d) => {
          const isToday = d.date === today, past = d.date < today;
          return (
            <li key={d.date} className={`rounded-2xl border bg-card p-3 ${isToday ? "border-accent" : "border-border"} ${past ? "opacity-60" : ""}`}>
              <p className={`text-[12px] font-semibold uppercase tracking-[0.1em] ${isToday ? "text-accent" : "text-dim"}`}>{isToday ? "Today · " : ""}{fmtDay(d.date)}</p>
              {d.events.length ? (
                <ul className="mt-1.5 space-y-1">
                  {d.events.map((e, i) => {
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
            </li>
          );
        })}
      </ol>

      {start && <WorkoutDays initial={workoutDays} />}
      <p className="text-xs text-dim">Every day: check off your habits, log your food and weigh in. Times are in your time zone.</p>
    </section>
  );
}
