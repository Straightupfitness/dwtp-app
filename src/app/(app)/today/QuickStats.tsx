import Link from "next/link";
import { IconPlate, IconScale, IconSteps } from "@/components/Icons";
import { logSteps, logWeight } from "./actions";

const display = "font-[family-name:var(--font-display)] uppercase";
const card = "flex min-w-0 flex-col gap-1.5 rounded-2xl border border-border bg-card p-2.5";
const input = "min-h-10 w-full min-w-0 rounded-lg border border-[#2a2a2a] bg-bg px-2.5 text-[16px] outline-none focus:border-accent";
const button = "mt-auto grid min-h-10 w-full place-items-center rounded-lg bg-accent text-sm font-semibold text-black";

function Title({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <p className={`${display} flex items-center gap-1 text-[15px] font-medium leading-none`}><span className="text-accent">{icon}</span>{children}</p>;
}

/** A big number, with a thin bar toward her target. */
function Stat({ value, unit, pct }: { value: string; unit: string; pct: number | null }) {
  return (
    <span className="block">
      <span className={`${display} block text-[22px] leading-none`}>{value}</span>
      <span className="mt-0.5 block text-[11px] text-dim">{unit}</span>
      {pct !== null && <span className="mt-1 block h-1 rounded-full bg-[#262626]"><span className="block h-1 rounded-full bg-accent" style={{ width: `${Math.min(100, Math.round(pct * 100))}%` }} /></span>}
    </span>
  );
}

/** A small trend line of her last 14 days of weigh-ins. */
function Spark({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const min = Math.min(...points), max = Math.max(...points), span = max - min || 1;
  const xy = points.map((p, i) => `${(2 + (i * 96) / (points.length - 1)).toFixed(1)},${(4 + ((max - p) / span) * 16).toFixed(1)}`);
  const last = xy[xy.length - 1].split(",");
  return (
    <svg className="w-full" height="24" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={xy.join(" ")} fill="none" stroke="#f5a623" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill="#f5a623" />
    </svg>
  );
}

/** Weight, food and steps side by side on Today (October 28). */
export default function QuickStats(p: {
  today: string; yesterday: string;
  weight: number | null; spark: number[]; change: number | null;
  kcal: number; kcalTarget: number | null; protein: number; proteinTarget: number;
  steps: number | null; stepsYesterday: number | null; stepGoal: number | null;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className={card}>
        <Title icon={<IconScale />}>Weight</Title>
        {p.weight !== null ? (
          <>
            <Stat value={p.weight.toFixed(1)} unit="lbs today" pct={null} />
            <Spark points={p.spark} />
            <p className={`mt-auto text-[11px] leading-tight ${p.change !== null && p.change <= 0 ? "text-[#7ee2a8]" : "text-[#a8a8a8]"}`}>
              {p.change === null ? "Logged today" : `${p.change > 0 ? "+" : "−"}${Math.abs(p.change).toFixed(1)} lbs in 2 weeks`}
            </p>
          </>
        ) : (
          <form action={logWeight} className="flex flex-1 flex-col gap-1.5">
            <input type="hidden" name="date" value={p.today} />
            <label className="sr-only" htmlFor="weight">Today&apos;s weight in lbs</label>
            <input id="weight" name="weight" type="number" step="0.1" inputMode="decimal" placeholder="lbs" required className={input} />
            <button className={button}>Log</button>
          </form>
        )}
      </div>

      <div className={card}>
        <Title icon={<IconPlate />}>Food</Title>
        <Stat value={p.kcal.toLocaleString()} unit="calories" pct={p.kcalTarget ? p.kcal / p.kcalTarget : null} />
        <Stat value={String(p.protein)} unit="g protein" pct={p.protein / p.proteinTarget} />
        <Link href="/food" className={button}>Add meal</Link>
      </div>

      <div className={card}>
        <Title icon={<IconSteps />}>Steps</Title>
        <Stat value={p.steps !== null ? p.steps.toLocaleString() : "–"} unit={p.stepGoal ? (p.steps !== null && p.steps >= p.stepGoal ? "goal hit" : `goal ${p.stepGoal.toLocaleString()}`) : "today"}
          pct={p.stepGoal && p.steps !== null ? p.steps / p.stepGoal : null} />
        <form action={logSteps} className="mt-auto flex flex-col gap-1.5">
          <label className="sr-only" htmlFor="steps">Steps from your phone or watch</label>
          <input id="steps" name="steps" inputMode="numeric" pattern="[0-9,]*" placeholder={p.steps !== null ? "Update" : "Steps"} required className={input} />
          <label className="sr-only" htmlFor="steps-day">Day</label>
          <select id="steps-day" name="date" defaultValue={p.today} className="min-h-8 w-full rounded-lg border border-[#2a2a2a] bg-bg px-1.5 text-[12px] outline-none focus:border-accent">
            <option value={p.today}>Today</option>
            <option value={p.yesterday}>Yesterday{p.stepsYesterday !== null ? ` (${p.stepsYesterday.toLocaleString()})` : ""}</option>
          </select>
          <button className={button}>Log</button>
        </form>
      </div>
    </div>
  );
}
