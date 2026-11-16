import Link from "next/link";
import type { Daily } from "@/lib/daily";
import WeightDots from "./WeightDots";
import DailyCombo from "./DailyCombo";

export const RANGES: [number, string][] = [[7, "7 days"], [30, "30 days"], [90, "3 months"], [180, "6 months"], [365, "12 months"]];

/**
 * November 15 (Michael): "Her progress" on her page. One timeline for every graph (7 days … 12 months), then her
 * weight and six graphs: calories, protein, fiber, potassium, water and steps.
 */
export default function CoachProgress({ data, range, base }: { data: Daily; range: number; base: string }) {
  const g = data.goals;
  const days = data.days.slice(-range);
  const from = days[0]?.date ?? data.today;
  const weights = data.weights.filter((w) => w.date >= from);
  const last = data.weights[data.weights.length - 1] ?? null;
  const lost = g.startWeight && last ? Math.round((g.startWeight - last.lbs) * 10) / 10 : null;
  const small = "font-[family-name:var(--font-display)] text-[13px] uppercase tracking-wide";
  return (
    <div className="space-y-5">
      <nav className="flex gap-1 rounded-[14px] border border-border bg-bg p-1" aria-label="How far back">
        {RANGES.map(([r, label]) => (
          <Link key={r} href={`${base}?r=${r}#progress`} scroll={false} aria-current={range === r ? "page" : undefined}
            className={`grid min-h-10 flex-1 place-items-center rounded-[10px] text-[12px] sm:text-[13px] ${range === r ? "bg-accent font-semibold text-black" : "text-dim"}`}>{label}</Link>
        ))}
      </nav>
      <div>
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3">
          <p className={small}>Weight</p>
          {lost !== null && lost !== 0 && <span className={`text-[12px] font-semibold ${lost > 0 ? "text-[#7ee2a8]" : "text-dim"}`}>{lost > 0 ? `−${lost}` : `+${-lost}`} lbs since the start</span>}
        </div>
        <WeightDots points={weights} goal={g.goalWeight} />
      </div>
      <DailyCombo days={days} goals={g} />
      <p className="text-[11px] text-dim">Solid = hit the target · faded = under it · red = over her calories · dashed line = target.</p>
    </div>
  );
}
