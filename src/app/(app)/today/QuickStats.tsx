import Link from "next/link";
import { IconPlate, IconScale } from "@/components/Icons";
import { logWeight } from "./actions";

const display = "font-[family-name:var(--font-display)] uppercase";
const card = "rounded-2xl border border-border bg-card p-3";
const button = "grid min-h-11 shrink-0 place-items-center rounded-lg bg-accent px-4 text-sm font-semibold text-black";

function Title({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <p className={`${display} flex items-center gap-1.5 text-[17px] font-medium leading-none`}><span className="text-accent">{icon}</span>{children}</p>;
}

/** A big number, with a thin bar toward her target. */
function Stat({ value, unit, pct }: { value: string; unit: string; pct: number | null }) {
  return (
    <span className="block min-w-0 flex-1">
      <span className={`${display} block text-[24px] leading-none`}>{value} <span className="text-[12px] normal-case text-dim">{unit}</span></span>
      {pct !== null && <span className="mt-1.5 block h-1 rounded-full bg-[#262626]"><span className="block h-1 rounded-full bg-accent" style={{ width: `${Math.min(100, Math.round(pct * 100))}%` }} /></span>}
    </span>
  );
}

/** A small trend line of her last 14 days of weigh-ins. */
function Spark({ points }: { points: number[] }) {
  if (points.length < 2) return <span className="flex-1" />;
  const min = Math.min(...points), max = Math.max(...points), span = max - min || 1;
  const xy = points.map((p, i) => `${(2 + (i * 96) / (points.length - 1)).toFixed(1)},${(4 + ((max - p) / span) * 18).toFixed(1)}`);
  const last = xy[xy.length - 1].split(",");
  return (
    <svg className="h-[28px] min-w-0 flex-1" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={xy.join(" ")} fill="none" stroke="#f5a623" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill="#f5a623" />
    </svg>
  );
}

/** Today's weight and Today's food, each a full-width row (October 28). Steps go in the weekly check-in now. */
export default function QuickStats(p: {
  today: string;
  weight: number | null; spark: number[]; change: number | null;
  kcal: number; kcalTarget: number | null; protein: number; proteinTarget: number;
}) {
  return (
    <>
      <div className={`${card} space-y-2.5`}>
        <Title icon={<IconScale />}>Today&apos;s weight</Title>
        {p.weight !== null ? (
          <div className="flex items-center gap-4">
            <span className={`${display} shrink-0 text-[26px] leading-none`}>{p.weight.toFixed(1)} <span className="text-[12px] normal-case text-dim">lbs</span></span>
            <Spark points={p.spark} />
            <span className={`shrink-0 text-right text-[12px] leading-tight ${p.change !== null && p.change <= 0 ? "text-[#7ee2a8]" : "text-[#a8a8a8]"}`}>
              {p.change === null ? "Logged today" : <>{p.change > 0 ? "+" : "−"}{Math.abs(p.change).toFixed(1)} lbs<br />in 2 weeks</>}
            </span>
          </div>
        ) : (
          <form action={logWeight} className="flex gap-2">
            <input type="hidden" name="date" value={p.today} />
            <label className="sr-only" htmlFor="weight">Today&apos;s weight in lbs</label>
            <input id="weight" name="weight" type="number" step="0.1" inputMode="decimal" placeholder="Weigh in (lbs)" required
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#2a2a2a] bg-bg px-3 text-lg outline-none focus:border-accent" />
            <button className={button}>Log</button>
          </form>
        )}
      </div>

      <div className={`${card} space-y-2.5`}>
        <Title icon={<IconPlate />}>Today&apos;s food</Title>
        <div className="flex items-center gap-4">
          <Stat value={p.kcal.toLocaleString()} unit="calories" pct={p.kcalTarget ? p.kcal / p.kcalTarget : null} />
          <Stat value={String(p.protein)} unit="g protein" pct={p.protein / p.proteinTarget} />
          <Link href="/food" className={button}>Add meal</Link>
        </div>
      </div>
    </>
  );
}
