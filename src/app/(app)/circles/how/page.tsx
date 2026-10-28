import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { circleColor } from "@/lib/circles";
import { programWeek, todayIn } from "@/lib/program";
import MedalCircle from "@/components/MedalCircle";
import StageBars from "@/components/JourneyBar";

const display = "font-[family-name:var(--font-display)] uppercase";
const label = "text-[11px] uppercase tracking-[0.15em] text-accent";
const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
const fmt = (d: string, year = false) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" });
const PHASES = [
  { name: "Rested", from: 1, to: 4, color: "#818cf8", line: "You sleep better." },
  { name: "Fueled", from: 5, to: 16, color: "#22c55e", line: "You eat right and get strong." },
  { name: "Driven", from: 17, to: 26, color: "#f5a623", line: "It all runs on its own." },
];

/** "How this works": the 26 weeks and the circles in very simple words, with her own dates. */
export default async function HowItWorks() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: me }, { data: weeks }, { data: rings }, { data: lessons }] = await Promise.all([
    supabase.from("profiles").select("program_start, timezone").eq("id", user!.id).single(),
    supabase.from("trajectory_weeks").select("week_number, is_diet_break, checkin_type, checkin_is_video, moments").lte("week_number", 26).order("week_number"),
    supabase.from("trajectory_week_rings").select("week_number, rings(name, ring_number, circles(name, slug))").lte("week_number", 26),
    supabase.from("lessons").select("kind, title, week_number").in("kind", ["sbw", "smf"]).lte("week_number", 26),
  ]);
  const start = me?.program_start ?? null;
  const now = programWeek(start, todayIn(me?.timezone ?? "America/Los_Angeles"));
  type R = { name: string; ring_number: number; circles: { name: string; slug: string } | null };
  const medalsFor = (w: number) => (rings ?? []).filter((r) => r.week_number === w).map((r) => r.rings as unknown as R | null).filter((r): r is R => !!r)
    .sort((a, b) => (a.circles?.name ?? "").localeCompare(b.circles?.name ?? ""));
  const lessonFor = (w: number, kind: string) => (lessons ?? []).find((l) => l.week_number === w && l.kind === kind)?.title;
  const momentsFor = (w: (typeof weeks extends (infer T)[] | null ? T : never)) => {
    const out: { text: string; cls: string }[] = [];
    if (w.is_diet_break) out.push({ text: "Diet break: eat at maintenance", cls: "bg-[#10261a] text-[#7ee2a8]" });
    if (w.moments?.includes("sleep_better_checkpoint")) out.push({ text: "Your 30-day sleep check", cls: "bg-[#1f1830] text-[#c4b5fd]" });
    if (w.checkin_type === "milestone") out.push({ text: "Results-so-far check-in", cls: "bg-[#1f1830] text-[#c4b5fd]" });
    else if (w.checkin_type === "results") out.push({ text: "Your 26-week results check-in", cls: "bg-[#1f1830] text-[#c4b5fd]" });
    else if (w.checkin_is_video) out.push({ text: "Video check-in", cls: "bg-[#1f1830] text-[#c4b5fd]" });
    return out;
  };

  return (
    <section className="space-y-7 pb-6">
      <Link href="/circles" className="inline-flex min-h-11 items-center text-sm text-dim">← Circles</Link>
      <header className="space-y-2">
        <p className={label}>How this works</p>
        <h1 className={`${display} text-[30px] font-semibold leading-tight`}>Your 26 weeks</h1>
        <p className="text-[16px] leading-relaxed text-[#d0d0d0]">
          Every week you learn a few new habits. You keep doing them. That&apos;s it.
          {start ? <> You started on <b className="text-text">{fmt(start)}</b> and finish on <b className="text-text">{fmt(addDays(start, 181), true)}</b>.</> : null}
        </p>
      </header>

      {/* The road */}
      <div className="space-y-3">
        <h2 className={label}>Three parts</h2>
        <StageBars week={now} />
        <div className="space-y-2">
          {PHASES.map((p) => (
            <div key={p.name} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5">
              <span className={`${display} w-20 shrink-0 text-[19px]`} style={{ color: p.color }}>{p.name}</span>
              <span className="flex-1 text-[15px]">{p.line}</span>
              <span className="shrink-0 text-right text-xs text-dim">Weeks {p.from}–{p.to}{start ? <><br />{fmt(addDays(start, (p.from - 1) * 7))} – {fmt(addDays(start, p.to * 7 - 1))}</> : null}</span>
            </div>
          ))}
        </div>
        <p className="text-[14px] text-[#a8a8a8]">You start <b className="text-[#94a3b8]">Drained</b>. You end <b className="text-accent">Driven</b>.</p>
      </div>

      {/* A week */}
      <div className="space-y-3">
        <h2 className={label}>Every week</h2>
        <ol className="space-y-2">
          {[
            ["Mon", "New habits. Open Lessons and read your Habits & Homework."],
            ["Tue", "Real Talk Tuesday: a group call with Michael on Zoom."],
            ["Wed", "Strong Body Wednesday: watch the video, take the quiz."],
            ["Fri", "Strong Mind Friday, and your check-in opens."],
            ["Mon noon", "Your check-in closes. Michael answers you. Your next week opens."],
          ].map(([d, t]) => (
            <li key={d} className="flex gap-3 rounded-xl border border-border bg-card p-3">
              <span className={`${display} w-[72px] shrink-0 text-[15px] text-accent`}>{d}</span>
              <span className="text-[15px]">{t}</span>
            </li>
          ))}
        </ol>
        <p className="text-[14px] text-[#a8a8a8]">Every day: check off your habits, log your food, and weigh in.</p>
      </div>

      {/* Circles */}
      <div className="space-y-3">
        <h2 className={label}>Circles and medals</h2>
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
          <MedalCircle medals={[1, 0.5, 0, 0, 0, 0, 0, 0, 0, 0]} color="#818cf8" size={112} center="1/10" detail label="Example: a circle with 10 medals. The first is done, the second is half full." />
          <div className="space-y-1.5 text-[15px] leading-snug">
            <p>A <b>circle</b> is one part of your health, like sleep or food.</p>
            <p>The dots around it are <b>medals</b>.</p>
            <p>A medal is a few small habits.</p>
          </div>
        </div>
        <ul className="space-y-2 text-[15px] leading-snug">
          {[
            ["Do a daily habit 14 days in a row.", "Then it's done."],
            ["Finish every habit in a medal.", "The medal fills up. +50 points."],
            ["Fill all the medals.", "The circle is done! +250 points."],
            ["Michael picked 3 circles just for you.", "In those, the next medal opens when you're halfway through the one before. You can go faster."],
            ["Other circles open when your weeks get there.", "You don't have to do anything."],
            ["Fix-it circles are for when you need them.", "A trip, the holidays, sore knees. Ask Michael."],
            ["You get points (CPs) for everything you do.", "Habits, check-ins, quizzes, medals."],
          ].map(([a, b]) => (
            <li key={a} className="flex gap-3 rounded-xl border border-border bg-card p-3">
              <span className="mt-[7px] size-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
              <span><b className="font-semibold">{a}</b> <span className="text-[#c8c8c8]">{b}</span></span>
            </li>
          ))}
        </ul>
      </div>

      {/* Week by week */}
      <div className="space-y-3">
        <h2 className={label}>Your weeks, one by one</h2>
        {PHASES.map((p) => (
          <div key={p.name} className="space-y-0">
            <p className={`${display} border-b-2 pb-1.5 text-[19px]`} style={{ color: p.color, borderColor: p.color }}>{p.name} · Weeks {p.from}–{p.to}</p>
            {(weeks ?? []).filter((w) => w.week_number >= p.from && w.week_number <= p.to).map((w) => {
              const n = w.week_number, here = n === now, done = now > n;
              const medals = medalsFor(n);
              const sbw = lessonFor(n, "sbw"), smf = lessonFor(n, "smf");
              return (
                <div key={n} className={`flex gap-3 border-b border-border py-3 ${here ? "-mx-2 rounded-xl border-b-0 bg-[#1a1409] px-2 ring-1 ring-accent" : ""} ${done ? "opacity-60" : ""}`}>
                  <div className="w-14 shrink-0">
                    <p className={`${display} text-[22px] leading-none`}>{n}</p>
                    {start && <p className="mt-0.5 text-[11px] text-dim">{fmt(addDays(start, (n - 1) * 7))}</p>}
                    {here && <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-accent">You are here</p>}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {medals.length ? (
                      <ul className="flex flex-wrap gap-1.5">
                        {medals.map((m) => {
                          const c = circleColor(m.circles?.slug ?? "");
                          return (
                            <li key={`${m.circles?.slug}-${m.ring_number}`} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px]"
                              style={{ borderColor: `${c}55`, background: `${c}1f` }}>
                              <span className="size-2 rounded-full" style={{ background: c }} aria-hidden="true" />
                              <span style={{ color: c }}>{m.circles?.name}</span> {m.name}
                            </li>
                          );
                        })}
                      </ul>
                    ) : <p className="text-[13px] text-[#c8c8c8]">No new habits. You look back at everything you built, and pick your next 3 circles.</p>}
                    {(sbw || smf) && <p className="text-[12.5px] text-dim">{sbw && <>Wednesday: {sbw}</>}{sbw && smf && " · "}{smf && <>Friday: {smf}</>}</p>}
                    {momentsFor(w).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {momentsFor(w).map((m) => <span key={m.text} className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${m.cls}`}>{m.text}</span>)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <p className="rounded-2xl border border-border bg-card p-4 text-[15px]">Stuck or confused? Tap <b>Chat</b> at the top. He&apos;s got you.</p>
    </section>
  );
}
