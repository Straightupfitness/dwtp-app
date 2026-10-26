import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadLessons } from "@/lib/lessons";
import LessonRow from "./LessonRow";

const display = "font-[family-name:var(--font-display)] uppercase";

export default async function LessonsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  const { current, weeks } = await loadLessons(supabase, user!.id, { coach: me?.role === "coach" });
  const shown = Math.max(1, current);
  const thisWeek = weeks.find((w) => w.week === shown);
  const past = weeks.filter((w) => w.week < shown).reverse();
  const next = weeks.filter((w) => w.week > shown);
  const doneOf = (w: (typeof weeks)[number]) => `${w.lessons.filter((l) => l.done).length}/${w.lessons.length}`;

  return (
    <section className="space-y-3.5">
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Learn the why</p>
        <h1 className={`${display} mt-1 text-[30px] font-semibold`}>Lessons</h1>
        {me?.role === "coach" && <Link href="/coach/lessons" className="text-sm text-accent">Edit lessons, videos and quizzes →</Link>}
      </header>

      {thisWeek && <>
        <h2 className="pt-1 text-[11px] uppercase tracking-[0.15em] text-accent">{current ? `This week · Week ${shown}` : "Your first week"}</h2>
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          {thisWeek.lessons.map((l) => <LessonRow key={l.id} l={l} />)}
        </div>
      </>}

      {past.length > 0 && <>
        <h2 className="pt-2 text-[11px] uppercase tracking-[0.15em] text-accent">Past weeks</h2>
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          {past.map((w) => (
            <details key={w.week} className="group">
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-3.5">
                <span className={`${display} flex-1 text-[17px]`}>Week {w.week}</span>
                <span className="text-xs text-dim">{doneOf(w)}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="2" aria-hidden="true" className="transition group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
              </summary>
              <div className="divide-y divide-border border-t border-border">{w.lessons.map((l) => <LessonRow key={l.id} l={l} />)}</div>
            </details>
          ))}
        </div>
      </>}

      {next.length > 0 && <>
        <h2 className="pt-2 text-[11px] uppercase tracking-[0.15em] text-accent">Coming up</h2>
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          {next.map((w) => (
            <details key={w.week} className="group">
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-3.5">
                <span className={`${display} flex-1 text-[17px] text-[#cbd5e1]`}>Week {w.week}</span>
                <span className="text-xs text-dim">{w.lessons[0]?.open ? "Open" : w.lessons[0]?.lockedReason}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="2" aria-hidden="true" className="transition group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
              </summary>
              <div className="divide-y divide-border border-t border-border">{w.lessons.map((l) => <LessonRow key={l.id} l={l} />)}</div>
            </details>
          ))}
        </div>
      </>}
    </section>
  );
}
