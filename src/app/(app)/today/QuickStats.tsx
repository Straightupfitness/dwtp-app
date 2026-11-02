import Link from "next/link";
import { IconPlate, IconScale } from "@/components/Icons";
import { logSteps, logWeight } from "./actions";

const display = "font-[family-name:var(--font-display)] uppercase";
const card = "rounded-2xl border border-border bg-card p-3.5";
const button = "grid min-h-11 shrink-0 place-items-center rounded-lg bg-accent px-4 text-sm font-semibold text-black";
const input = "min-h-11 min-w-0 flex-1 rounded-lg border border-[#2a2a2a] bg-bg px-3 text-lg outline-none focus:border-accent";
const letter = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "narrow", timeZone: "UTC" });
const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));

function Title({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <p className={`${display} flex items-center gap-1.5 text-[15px] font-medium leading-none text-[#cfcfcf]`}><span className="text-accent">{icon}</span>{children}</p>;
}
function Steps() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3c1.7 0 3 2 3 4.5S10 12 8.5 12 6 10 6 7.5 6.3 3 8 3zM7 15h3v2.5A1.5 1.5 0 0 1 8.5 19 1.5 1.5 0 0 1 7 17.5zM16 6c1.7 0 2 2.5 2 5s-1 4.5-2.5 4.5S13 13.5 13 11s1.3-5 3-5zM14 18.5h3V21a1.5 1.5 0 0 1-3 0z" /></svg>;
}

export type DayVal = { date: string; value: number | null };

/** Her weight over the last 7 days: dots joined by a line, each day labeled. */
function WeightWeek({ days }: { days: DayVal[] }) {
  const vals = days.map((d) => d.value).filter((v): v is number => v !== null);
  if (!vals.length) return null;
  const lo = Math.min(...vals) - 0.6, hi = Math.max(...vals) + 0.6;
  const x = (i: number) => 7 + i * (86 / 6);
  const y = (v: number) => 8 + ((hi - v) / (hi - lo)) * 30;
  const pts = days.map((d, i) => (d.value === null ? null : { x: x(i), y: y(d.value), v: d.value }));
  const line = pts.filter(Boolean).map((p, i) => `${i ? "L" : "M"}${p!.x.toFixed(1)},${p!.y.toFixed(1)}`).join(" ");
  return (
    <div aria-label={`Weight, last 7 days: ${days.map((d) => d.value ?? "none").join(", ")}`}>
      <svg viewBox="0 0 100 44" className="block h-[64px] w-full" preserveAspectRatio="none" aria-hidden="true">
        <path d={line} fill="none" stroke="#f5a623" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity="0.8" />
      </svg>
      <div className="-mt-[64px] grid h-[64px] grid-cols-7">
        {pts.map((p, i) => (
          <span key={days[i].date} className="relative">
            {p && <>
              <span className="absolute left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" style={{ top: `${(p.y / 44) * 100}%` }} />
              <span className="absolute left-1/2 -translate-x-1/2 text-[10px] tabular-nums text-[#cfcfcf]" style={{ top: `calc(${(p.y / 44) * 100}% - 18px)` }}>{p.v.toFixed(1)}</span>
            </>}
          </span>
        ))}
      </div>
      <Letters days={days} />
    </div>
  );
}

/** One or two bars per day (calories and protein, or steps), toward a goal. */
function BarsWeek({ days, goal, color, second }: {
  days: DayVal[]; goal: number | null; color: string;
  second?: { days: DayVal[]; goal: number; color: string };
}) {
  const top = Math.max(1, ...days.map((d) => d.value ?? 0), goal ?? 0) * 1.1;
  const top2 = second ? Math.max(1, ...second.days.map((d) => d.value ?? 0), second.goal) * 1.1 : 1;
  return (
    <div>
      <div className="relative grid h-[64px] grid-cols-7 items-end gap-1.5">
        {goal ? <span className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[#5a5a5a]" style={{ bottom: `${(goal / top) * 100}%` }} /> : null}
        {days.map((d, i) => {
          const s = second?.days[i];
          return (
            <span key={d.date} className="flex h-full items-end justify-center gap-[2px]" title={`${d.date}: ${d.value ?? "–"}${s ? ` · ${s.value ?? "–"} g` : ""}`}>
              <span className="w-full max-w-[14px] rounded-t-[3px]" style={{ height: `${((d.value ?? 0) / top) * 100}%`, minHeight: d.value ? 2 : 0, background: color, opacity: goal && d.value && d.value >= goal * 0.9 ? 1 : 0.75 }} />
              {second && s && <span className="w-full max-w-[8px] rounded-t-[3px]" style={{ height: `${((s.value ?? 0) / top2) * 100}%`, minHeight: s.value ? 2 : 0, background: second.color }} />}
            </span>
          );
        })}
      </div>
      <Letters days={days} />
    </div>
  );
}
function Letters({ days }: { days: DayVal[] }) {
  return (
    <div className="mt-1 grid grid-cols-7 text-center text-[10px] text-dim">
      {days.map((d, i) => <span key={d.date} className={i === days.length - 1 ? "font-semibold text-text" : ""}>{letter(d.date)}</span>)}
    </div>
  );
}

/**
 * November 2: Today asks the morning questions in Michael's words. Weight this morning, steps yesterday, food so far,
 * each with her last 7 days underneath. They start over at midnight (her time).
 */
export default function QuickStats(p: {
  today: string; yesterday: string;
  weight: number | null; change: number | null; weightWeek: DayVal[];
  steps: number | null; stepGoal: number; stepsWeek: DayVal[];
  kcal: number; kcalTarget: number | null; protein: number; proteinTarget: number; kcalWeek: DayVal[]; proteinWeek: DayVal[];
}) {
  return (
    <>
      <div className={`${card} space-y-3`}>
        <Title icon={<IconScale />}>Morning weigh-in</Title>
        {p.weight !== null ? (
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[16px] leading-snug">You weighed <b className={`${display} text-[24px]`}>{p.weight.toFixed(1)}</b> lbs this morning</p>
            {p.change !== null && <span className={`shrink-0 text-right text-[12px] leading-tight ${p.change <= 0 ? "text-[#7ee2a8]" : "text-[#a8a8a8]"}`}>{p.change > 0 ? "+" : "−"}{Math.abs(p.change).toFixed(1)} lbs<br />this week</span>}
          </div>
        ) : (
          <form action={logWeight} className="space-y-2">
            <label htmlFor="weight" className="block text-[16px] font-semibold">What was your weight this morning?</label>
            <div className="flex gap-2">
              <input type="hidden" name="date" value={p.today} />
              <input id="weight" name="weight" type="number" step="0.1" inputMode="decimal" placeholder="lbs" required className={input} />
              <button className={button}>Log</button>
            </div>
          </form>
        )}
        <WeightWeek days={p.weightWeek} />
      </div>

      <div className={`${card} space-y-3`}>
        <Title icon={<Steps />}>Steps</Title>
        {p.steps !== null ? (
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[16px] leading-snug">You got <b className={`${display} text-[24px]`}>{p.steps.toLocaleString()}</b> steps yesterday</p>
            <span className={`shrink-0 text-[12px] ${p.steps >= p.stepGoal ? "text-[#7ee2a8]" : "text-[#a8a8a8]"}`}>{p.steps >= p.stepGoal ? "Goal hit ✓" : `Goal ${k(p.stepGoal)}`}</span>
          </div>
        ) : (
          <form action={logSteps} className="space-y-2">
            <label htmlFor="steps" className="block text-[16px] font-semibold">How many steps did you get yesterday?</label>
            <div className="flex gap-2">
              <input type="hidden" name="date" value={p.yesterday} />
              <input id="steps" name="steps" type="text" inputMode="numeric" pattern="[0-9,]*" placeholder="Steps" required className={input} />
              <button className={button}>Log</button>
            </div>
            <p className="text-[12px] text-dim">Check your phone or watch for yesterday&apos;s total when you weigh in.</p>
          </form>
        )}
        {p.stepsWeek.some((d) => d.value) && <BarsWeek days={p.stepsWeek} goal={p.stepGoal} color="#a3e635" />}
      </div>

      <div className={`${card} space-y-3`}>
        <Title icon={<IconPlate />}>Food</Title>
        <p className="text-[16px] leading-snug">You&apos;ve eaten <b className={`${display} text-[24px]`}>{p.kcal.toLocaleString()}</b> calories so far today{p.kcal > 0 && <span className="text-[#a8a8a8]">, with {p.protein} g protein</span>}{p.kcalTarget ? <span className="block text-[12px] text-dim">Your target: {p.kcalTarget.toLocaleString()} calories · {p.proteinTarget} g protein</span> : null}</p>
        <Link href="/food" className="grid min-h-12 place-items-center rounded-xl bg-accent text-[15px] font-semibold text-black">Log your food</Link>
        {p.kcalWeek.some((d) => d.value) && <>
          <BarsWeek days={p.kcalWeek} goal={p.kcalTarget} color="#f5a623" second={{ days: p.proteinWeek, goal: p.proteinTarget, color: "#60a5fa" }} />
          <p className="flex gap-3 text-[11px] text-dim"><span><span className="mr-1 inline-block size-2 rounded-sm bg-accent" />Calories</span><span><span className="mr-1 inline-block size-2 rounded-sm bg-[#60a5fa]" />Protein</span>{p.kcalTarget ? <span>- - target</span> : null}</p>
        </>}
      </div>
    </>
  );
}
