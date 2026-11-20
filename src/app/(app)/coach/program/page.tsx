import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { circleColor } from "@/lib/circles";
import { KIND_LABEL } from "@/lib/lessons";
import SmoothDrawers from "@/components/SmoothDrawers";

export const dynamic = "force-dynamic";

const display = "font-[family-name:var(--font-display)] uppercase";
const PHASE: Record<string, { label: string; color: string }> = {
  rested: { label: "Rested", color: "#818cf8" }, fueled: { label: "Fueled", color: "#f97316" }, driven: { label: "Driven", color: "#f5a623" }, continuation: { label: "Year 2 half", color: "#22c55e" },
};
const MOMENT: Record<string, string> = {
  upsell_1: "Upsell 1: the full year", onboarding_call: "Onboarding call", upsell_2: "Upsell 2", sleep_better_checkpoint: "Sleep Better checkpoint (Day 30)",
  upsell_3: "Upsell 3: halfway", last_chance: "Last chance: renewal", guarantee_15lb: "15 Pound Guarantee check",
};
const CHECKIN: Record<string, string> = {
  week1: "Week 1 check-in", standard: "Check-in", four_week: "4-week check-in", milestone: "Milestone check-in", halfway: "Halfway check-in", last_chance: "Last-chance check-in", results: "Results check-in",
};

type Row = Record<string, unknown>;
async function all(get: (a: number, b: number) => PromiseLike<{ data: unknown[] | null }>): Promise<Row[]> {
  const out: Row[] = [];
  for (let a = 0; ; a += 1000) { const { data } = await get(a, a + 999); out.push(...((data ?? []) as Row[])); if (!data || data.length < 1000) return out; }
}

/** One box in the flow chart. */
function Step({ n, title, sub, color = "#f5a623", children }: { n?: string; title: string; sub?: string; color?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-3" style={{ borderColor: `${color}99` }}>
      <p className="flex items-baseline gap-2">
        {n && <span className="grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-bold text-black" style={{ background: color }}>{n}</span>}
        <span className="text-[15px] font-semibold">{title}</span>
      </p>
      {sub && <p className="mt-1 text-[13px] text-dim">{sub}</p>}
      {children}
    </div>
  );
}
const Down = () => <div className="flex justify-center py-1 text-[#5a5a5a]" aria-hidden="true">↓</div>;

/**
 * November 19 (Michael): his Program tab. How a client moves through the program (a flow chart), every week's lessons,
 * medals and moments for the whole year, and every circle with its medals, as a reference.
 */
export default async function ProgramPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  if (me?.role !== "coach") redirect("/lessons");
  const [weeks, lessons, twr, rings, circles, items] = await Promise.all([
    all((a, b) => supabase.from("trajectory_weeks").select("week_number, phase, checkin_type, checkin_is_video, is_diet_break, moments").order("week_number").range(a, b)),
    all((a, b) => supabase.from("lessons").select("id, kind, number, title, video_url, quiz_status, week_number, retired").not("week_number", "is", null).range(a, b)),
    all((a, b) => supabase.from("trajectory_week_rings").select("week_number, ring_id").range(a, b)),
    all((a, b) => supabase.from("rings").select("id, circle_id, ring_number, name, outcome").order("ring_number").range(a, b)),
    all((a, b) => supabase.from("circles").select("id, slug, name, kind, method_part, goal, sort").order("sort").range(a, b)),
    all((a, b) => supabase.from("ring_items").select("ring_id, item_type, cadence, title, sort").order("sort").range(a, b)),
  ]);
  const R = new Map(rings.map((r) => [r.id as string, r]));
  const C = new Map(circles.map((c) => [c.id as string, c]));
  const order: Record<string, number> = { hh: 0, sbw: 1, smf: 2, other: 3 };
  const maxWeek = Math.max(26, ...weeks.map((w) => w.week_number as number), ...lessons.map((l) => l.week_number as number));
  const weekNums = Array.from({ length: maxWeek }, (_, i) => i + 1);
  const growth = circles.filter((c) => c.kind === "growth"), fixits = circles.filter((c) => c.kind !== "growth");
  const tab = "inline-flex min-h-10 items-center rounded-full border border-border px-4 text-sm hover:border-accent";

  return (
    <section className="mx-auto max-w-5xl space-y-4 pb-28">
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">The Driven Woman Transformation Program</p>
        <h1 className={`${display} mt-1 text-[30px] font-semibold`}>Program</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <a href="#flow" className={tab}>Flow chart</a><a href="#weeks" className={tab}>Week by week</a><a href="#circles" className={tab}>Circles</a>
          <Link href="/coach/lessons" className={tab}>Edit lessons &amp; quizzes</Link>
        </div>
      </header>

      {/* ── Flow chart ── */}
      <div id="flow" className="scroll-mt-20 space-y-2">
        <h2 className={`${display} text-xl`}>How a client goes through it</h2>
        <div className="grid gap-x-4 md:grid-cols-2">
          <div>
            <Step n="1" title="Workshop: Fix Your Sleep, Lose the Weight" sub="About 45 minutes, pitch at the end." />
            <Down />
            <Step n="2" title="She texts DRIVEN to 562 650 7530" sub="You reply with your calendar link." />
            <Down />
            <Step n="3" title="30-minute assessment call" sub="Her sleep, energy, history and goals, and whether it fits." />
            <Down />
            <Step n="4" title="She joins" sub="26 weeks $1,500 or 52 weeks $2,500 · Sleep Better Guarantee (30 days) + 15 Pound Guarantee (26 weeks)." />
            <Down />
            <Step n="5" title="App login → ONB-01 welcome video" sub="3 quick questions unlock the Blueprint." />
            <Down />
            <Step n="6" title="Driven Woman Blueprint" sub="19 questions with your 7X videos. The app picks her 3 focus circles, opens fix-its, and opens Week 1's Habits & Homework." />
            <Down />
            <Step n="7" title="Onboarding call (30 min) · Upsell 1" sub="New clients. Restarting clients get your video reply instead. The full year for +$1,000 at the end, and again the next day." />
            <Down />
            <Step n="8" title="First Monday: workouts go live, Week 1 starts" />
          </div>
          <div className="mt-2 md:mt-0">
            <Step title="Every week" color="#38bdf8">
              <ol className="mt-1.5 space-y-0.5 text-[13px] text-[#cfcfcf]">
                <li><b>Mon</b> · Habits &amp; Homework opens (after last week&apos;s check-in)</li>
                <li><b>Tue</b> · Real Talk Tuesday group call</li>
                <li><b>Wed</b> · Strong Body Wednesday</li>
                <li><b>Fri</b> · Strong Mind Friday + check-in opens</li>
                <li><b>Mon noon</b> · Check-in closes → your reply</li>
                <li><b>Every day</b> · Habits, food, weight, steps, water, sleep, workouts · chat with you</li>
              </ol>
            </Step>
            <Down />
            <Step title="Rested · weeks 1–4" sub="The Circadian Reset: 3-Hour Window, Blinking Method, No-Nap Nap, caffeine rules. Strength starts." color={PHASE.rested.color}>
              <p className="mt-1 text-[12px] text-[#c7c9ff]">Week 4: Sleep Better checkpoint (Day 30) · Upsell 2 · video check-in</p>
            </Step>
            <Down />
            <Step title="Fueled · weeks 5–16" sub="The Metabolism Fix: protein, logging, smart deficit, supplements, steps up to 10,000, cardio." color={PHASE.fueled.color}>
              <p className="mt-1 text-[12px] text-[#ffc79a]">Diet breaks weeks 8 and 16 · Week 12 milestone check-in (results, testimonial) · Week 13 halfway · Upsell 3</p>
            </Step>
            <Down />
            <Step title="Driven · weeks 17–26" sub="It becomes her lifestyle: potassium, fiber, eating out, events, role model." color={PHASE.driven.color}>
              <p className="mt-1 text-[12px] text-[#ffd98a]">Week 24 diet break + last chance (next 26 weeks $1,500 or $250 a month) · Week 26 results check-in · 15 Pound Guarantee check · she picks her next 3 circles</p>
            </Step>
            <Down />
            <Step title="Weeks 27–52 (full year)" sub="The trajectory keeps going, diet breaks at 32, 40 and 48, milestone check-ins at 36 and 52." color={PHASE.continuation.color} />
          </div>
        </div>
      </div>

      {/* ── Week by week ── */}
      <div id="weeks" className="scroll-mt-20 space-y-2">
        <h2 className={`${display} text-xl`}>Week by week</h2>
        <p className="text-[13px] text-dim">Every week of the year: its phase, check-in, moments, the medals she starts, and the lessons. Tap a week to open it, and a lesson to edit it.</p>
        {/* The year at a glance: one square per week, colored by phase. */}
        <div className="flex flex-wrap gap-1">
          {weekNums.map((n) => {
            const w = weeks.find((x) => x.week_number === n);
            const ph = PHASE[(w?.phase as string) ?? ""];
            return <a key={n} href={`#week-${n}`} title={`Week ${n}${ph ? ` · ${ph.label}` : ""}`} className="grid size-8 place-items-center rounded-md text-[11px] font-semibold text-black"
              style={{ background: ph?.color ?? "#3a3a3a", outline: (w?.moments as string[] | null)?.length ? "2px solid #fff" : undefined }}>{n}</a>;
          })}
        </div>
        <p className="flex flex-wrap gap-3 text-[11px] text-dim">{Object.values(PHASE).map((p) => <span key={p.label} className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm" style={{ background: p.color }} />{p.label}</span>)}<span>White outline = a key moment</span></p>
        <div className="space-y-1.5">
          {weekNums.map((n) => {
            const w = weeks.find((x) => x.week_number === n);
            const ph = PHASE[(w?.phase as string) ?? ""];
            const medals = twr.filter((t) => t.week_number === n).map((t) => R.get(t.ring_id as string)).filter(Boolean) as Row[];
            const ls = lessons.filter((l) => l.week_number === n && !l.retired).sort((a, b) => order[a.kind as string] - order[b.kind as string]);
            const moments = ((w?.moments as string[] | null) ?? []).map((m) => MOMENT[m] ?? m);
            return (
              <details key={n} id={`week-${n}`} data-drawer className="group scroll-mt-20 rounded-xl border border-border bg-card">
                <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-3 py-2">
                  <span className="w-16 shrink-0 text-[13px] font-semibold">Week {n}</span>
                  {ph && <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold text-black" style={{ background: ph.color }}>{ph.label}</span>}
                  <span className="min-w-0 flex-1 truncate text-[12px] text-dim">
                    {[w?.is_diet_break ? "Diet break" : null, w ? `${CHECKIN[w.checkin_type as string] ?? "Check-in"}${w.checkin_is_video ? " (video)" : ""}` : null, ...moments].filter(Boolean).join(" · ")}
                  </span>
                  <span className="shrink-0 text-[11px] text-dim">{medals.length} medal{medals.length === 1 ? "" : "s"} · {ls.length} lesson{ls.length === 1 ? "" : "s"}</span>
                </summary>
                <div className="grid gap-3 px-3 pb-3 md:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-accent">Medals she starts</p>
                    {medals.length ? medals.map((r) => {
                      const c = C.get(r.circle_id as string);
                      return (
                        <div key={r.id as string} className="mt-1.5">
                          <p className="text-[13px] font-semibold" style={{ color: circleColor((c?.slug as string) ?? "") }}>{c?.name as string} · Medal {r.ring_number as number}: {r.name as string}</p>
                          <ul className="ml-3 list-disc text-[12px] text-[#cfcfcf]">{items.filter((i) => i.ring_id === r.id).map((i, k) => <li key={k}>{i.title as string}{i.cadence === "weekly" ? " (weekly)" : ""}</li>)}</ul>
                        </div>
                      );
                    }) : <p className="mt-1 text-[12px] text-dim">No new medals this week.</p>}
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-accent">Lessons</p>
                    <ul className="mt-1 divide-y divide-border rounded-lg border border-border">
                      {ls.map((l) => (
                        <li key={l.id as string}>
                          <Link href={`/coach/lessons/${l.id}`} className="flex min-h-10 items-center gap-2 px-2.5 py-1.5 hover:bg-[#161616]">
                            <span className="w-28 shrink-0 text-[11px] uppercase tracking-wide text-dim">{KIND_LABEL[l.kind as string] ?? "Lesson"}</span>
                            <span className="min-w-0 flex-1 truncate text-[13px]">{l.title as string}</span>
                            {l.kind !== "smf" && !l.video_url && <span className="shrink-0 text-[11px] text-[#ff8a7e]">no video</span>}
                          </Link>
                        </li>
                      ))}
                      {!ls.length && <li className="px-2.5 py-2 text-[12px] text-dim">No lessons this week.</li>}
                    </ul>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </div>

      {/* ── Circles ── */}
      <div id="circles" className="scroll-mt-20 space-y-2">
        <h2 className={`${display} text-xl`}>Circles</h2>
        {[["Growth circles", growth], ["Fix-it circles", fixits]].map(([title, list]) => (
          <div key={title as string} className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-[0.12em] text-accent">{title as string}</p>
            {(list as Row[]).map((c) => {
              const rs = rings.filter((r) => r.circle_id === c.id);
              const color = circleColor(c.slug as string);
              return (
                <details key={c.id as string} data-drawer className="group rounded-xl border bg-card" style={{ borderColor: `${color}66` }}>
                  <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-3 py-2">
                    <span className="size-3 shrink-0 rounded-full" style={{ background: color }} />
                    <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold">{c.name as string}</span>{c.goal ? <span className="block text-[12px] text-dim">{c.goal as string}</span> : null}</span>
                    <span className="shrink-0 text-[12px] text-dim">{rs.length} medals</span>
                  </summary>
                  <ol className="space-y-2 px-3 pb-3">
                    {rs.map((r) => (
                      <li key={r.id as string}>
                        <p className="text-[13px] font-semibold"><span style={{ color }}>Medal {r.ring_number as number}</span> · {r.name as string}{r.outcome ? <span className="font-normal text-dim"> · {r.outcome as string}</span> : null}</p>
                        <ul className="ml-3 list-disc text-[12px] text-[#cfcfcf]">{items.filter((i) => i.ring_id === r.id).map((i, k) => <li key={k}>{i.title as string}{i.cadence === "weekly" ? " (weekly)" : i.item_type === "hit" ? " (you sign it off)" : ""}</li>)}</ul>
                      </li>
                    ))}
                  </ol>
                </details>
              );
            })}
          </div>
        ))}
      </div>
      <SmoothDrawers />
    </section>
  );
}
