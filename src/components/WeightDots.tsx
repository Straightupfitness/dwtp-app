"use client";
import { useState } from "react";

const short = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/**
 * November 15 (Michael): her weight line with every weigh-in as a dot on it. Tap or hover a dot to see the day and
 * the number (and the change from the one before). Replaces the "Every weigh-in" list on his view.
 */
export default function WeightDots({ points, goal }: { points: { date: string; lbs: number }[]; goal: number | null }) {
  const [sel, setSel] = useState<number>(points.length - 1);
  if (points.length < 2) return <p className="py-6 text-center text-[13px] text-dim">{points.length ? `One weigh-in so far: ${points[0].lbs} lbs.` : "No weigh-ins yet."}</p>;
  const t0 = Date.parse(points[0].date), t1 = Date.parse(points[points.length - 1].date), span = Math.max(1, t1 - t0);
  const ws = points.map((p) => p.lbs).concat(goal ? [goal] : []);
  const lo = Math.min(...ws) - 2, hi = Math.max(...ws) + 2;
  const W = 300, H = 150;
  const x = (d: string) => ((Date.parse(d) - t0) / span) * (W - 12) + 6;
  const y = (v: number) => H - 8 - ((v - lo) / (hi - lo)) * (H - 16);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.lbs).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const s = points[sel] ?? last, prev = points[sel - 1];
  const ch = prev ? Math.round((s.lbs - prev.lbs) * 10) / 10 : null;
  const dot = points.length > 120 ? 5 : points.length > 60 ? 7 : 9;
  return (
    <div>
      <p className="mb-1 text-[13px]"><b>{s.lbs} lbs</b> <span className="text-dim">· {short(s.date)}</span>
        {ch !== null && ch !== 0 && <span className={`ml-1.5 text-[12px] ${ch < 0 ? "text-[#7ee2a8]" : "text-dim"}`}>{ch > 0 ? "+" : "−"}{Math.abs(ch)} from the one before</span>}</p>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-40 w-full" role="img" aria-label={`Weight from ${points[0].lbs} to ${last.lbs} lbs, ${points.length} weigh-ins`}>
          {goal && <line x1="0" x2={W} y1={y(goal)} y2={y(goal)} stroke="#7ee2a8" strokeWidth="1" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
          <path d={`${path} L${x(last.date)},${H} L${x(points[0].date)},${H} Z`} fill="#f5a623" opacity="0.08" />
          <path d={path} fill="none" stroke="#f5a623" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity="0.7" />
        </svg>
        {points.map((p, i) => (
          <button key={p.date + i} type="button" onClick={() => setSel(i)} onMouseEnter={() => setSel(i)} aria-label={`${short(p.date)}: ${p.lbs} lbs`}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${(x(p.date) / W) * 100}%`, top: `${(y(p.lbs) / H) * 100}%`, width: Math.max(dot, 14), height: Math.max(dot, 14) }}>
            <span className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${i === sel ? "bg-white ring-2 ring-[#f5a623]" : "bg-[#f5a623]"}`} style={{ width: i === sel ? dot + 3 : dot - 2, height: i === sel ? dot + 3 : dot - 2 }} />
          </button>
        ))}
        {goal && <span className="pointer-events-none absolute right-0 -translate-y-full pb-0.5 text-[10px] text-[#7ee2a8]" style={{ top: `${(y(goal) / H) * 100}%` }}>Goal {goal}</span>}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-dim"><span>{short(points[0].date)}</span><span>{points.length} weigh-ins · tap a dot</span><span>{short(last.date)}</span></div>
    </div>
  );
}
