/** Small server-drawn charts for Progress (October 29): one bar per day, and her weight as a line. */

const short = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * One bar per day. Days that hit the goal (inside the band, or over the line for "at least" goals) are full color;
 * the rest are a quieter tint. Empty days have no bar.
 */
export function DayBars({ days, color, goal, band, unit, fmt = (n) => Math.round(n).toLocaleString() }: {
  days: { date: string; value: number | null }[]; color: string; unit: string;
  goal?: number | null; band?: [number, number] | null; fmt?: (n: number) => string;
}) {
  const vals = days.map((d) => d.value).filter((v): v is number => v !== null && v > 0);
  const top = Math.max(1, ...vals, goal ?? 0, band?.[1] ?? 0) * 1.08;
  const n = days.length, W = n * 10, H = 100;
  const y = (v: number) => H - (v / top) * H;
  const hit = (v: number) => (band ? v >= band[0] && v <= band[1] : goal ? v >= goal : true);
  const logged = vals.length;
  const hits = days.filter((d) => d.value !== null && d.value > 0 && hit(d.value)).length;
  const avg = logged ? vals.reduce((a, b) => a + b, 0) / logged : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-[12px] text-dim">
        <span>{logged ? <>Average <b className="text-text">{fmt(avg)}</b> {unit}</> : "Nothing logged yet"}</span>
        {(goal || band) && logged > 0 && <span><b className="text-text">{hits}</b> of {logged} days on target</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-24 w-full" role="img"
        aria-label={`${unit} per day, ${logged} days logged${goal ? `, goal ${fmt(goal)}` : ""}`}>
        {band && <rect x="0" y={y(band[1])} width={W} height={Math.max(1, y(band[0]) - y(band[1]))} fill={color} opacity="0.12" />}
        {days.map((d, i) => d.value !== null && d.value > 0 && (
          <rect key={d.date} x={i * 10 + 1.5} width="7" y={y(d.value)} height={H - y(d.value)} rx="1.5"
            fill={color} opacity={hit(d.value) ? 1 : 0.35}><title>{`${short(d.date)}: ${fmt(d.value)} ${unit}`}</title></rect>
        ))}
        {goal && <line x1="0" x2={W} y1={y(goal)} y2={y(goal)} stroke="#e5e5e5" strokeWidth="1" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" opacity="0.7" />}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-dim">
        <span>{short(days[0].date)}</span><span>{short(days[Math.floor(n / 2)].date)}</span><span>{short(days[n - 1].date)}</span>
      </div>
    </div>
  );
}

/** Her weigh-ins as a line, with her goal as a dashed line. */
export function WeightLine({ points, goal }: { points: { date: string; lbs: number }[]; goal: number | null }) {
  if (points.length < 2) return <p className="py-6 text-center text-[13px] text-dim">{points.length ? "One weigh-in so far. Your line starts with the next one." : "No weigh-ins yet. Log one on Today."}</p>;
  const t0 = Date.parse(points[0].date), t1 = Date.parse(points[points.length - 1].date), span = Math.max(1, t1 - t0);
  const ws = points.map((p) => p.lbs).concat(goal ? [goal] : []);
  const lo = Math.min(...ws) - 2, hi = Math.max(...ws) + 2;
  const W = 300, H = 120;
  const x = (d: string) => ((Date.parse(d) - t0) / span) * (W - 8) + 4;
  const y = (v: number) => H - 6 - ((v - lo) / (hi - lo)) * (H - 12);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.lbs).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-32 w-full" role="img" aria-label={`Weight from ${points[0].lbs} to ${last.lbs} lbs`}>
          {goal && <line x1="0" x2={W} y1={y(goal)} y2={y(goal)} stroke="#7ee2a8" strokeWidth="1" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
          <path d={`${path} L${x(last.date)},${H} L${x(points[0].date)},${H} Z`} fill="#f5a623" opacity="0.08" />
          <path d={path} fill="none" stroke="#f5a623" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f5a623] ring-2 ring-[#121212]"
          style={{ left: `${(x(last.date) / W) * 100}%`, top: `${(y(last.lbs) / H) * 100}%` }} aria-hidden="true" />
        {goal && <span className="absolute right-0 -translate-y-full pb-0.5 text-[10px] text-[#7ee2a8]" style={{ top: `${(y(goal) / H) * 100}%` }}>Goal {goal}</span>}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-dim"><span>{short(points[0].date)}</span><span>{short(last.date)}</span></div>
    </div>
  );
}
