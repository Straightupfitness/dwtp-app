import type { Daily } from "@/lib/daily";

const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));
const wk = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "narrow", timeZone: "UTC" });

/**
 * November 15 (Michael): food, water and steps in one chart. One group of bars per day: calories, protein, fiber,
 * potassium, water, steps. A bar is solid when she hit the target and faded when she was under it; calories over
 * the target are red. The dashed line is the target (every bar is drawn against its own target). Averages on the left.
 */
export default function DailyCombo({ days, goals, withWeight = false, only }: { days: Daily["days"]; goals: Daily["goals"]; withWeight?: boolean; only?: string[] }) {
  const g = goals;
  type Row = { key: string; label: string; color: string; unit: string; goal: number | null; get: (d: Daily["days"][number]) => number | null; hit: (v: number) => "hit" | "under" | "over" };
  const rows: Row[] = [
    { key: "cal", label: "Calories", color: "#f5a623", unit: "kcal", goal: g.calories || null, get: (d) => (d.meals ? d.calories : null),
      hit: (v) => (!g.calories ? "hit" : v > g.calories + 100 ? "over" : v >= g.calories - 100 ? "hit" : "under") },
    { key: "pro", label: "Protein", color: "#f97316", unit: "g", goal: g.protein, get: (d) => (d.meals ? d.protein : null), hit: (v) => (v >= g.protein - 10 ? "hit" : "under") },
    { key: "fib", label: "Fiber", color: "#22c55e", unit: "g", goal: g.fiber, get: (d) => (d.meals ? d.fiber : null), hit: (v) => (v >= g.fiber - 5 ? "hit" : "under") },
    { key: "pot", label: "Potassium", color: "#c084fc", unit: "mg", goal: g.potassium, get: (d) => (d.meals ? d.potassium : null), hit: (v) => (v >= g.potassium - 500 ? "hit" : "under") },
    // November 23 (Michael): calories from alcoholic drinks, above water. No target: fewer is better.
    { key: "alc", label: "Alcohol", color: "#fb7185", unit: "kcal", goal: null, get: (d) => (d.meals ? d.alcohol ?? 0 : null), hit: () => "hit" },
    { key: "wat", label: "Water", color: "#38bdf8", unit: "oz", goal: g.water, get: (d) => d.water ?? null, hit: (v) => (v >= g.water ? "hit" : "under") },
    { key: "stp", label: "Steps", color: "#a3e635", unit: "", goal: g.steps, get: (d) => d.steps ?? null, hit: (v) => (v >= g.steps ? "hit" : "under") },
  ];
  const shown = only ? rows.filter((r) => only.includes(r.key)) : rows;
  const H = 96, CAP = 1.5; // a bar at the dashed line = right on target; taller = over (capped at 1.5×)
  const vals = (r: Row) => days.map(r.get).filter((x): x is number => x !== null && x > 0);
  const avg = (r: Row) => { const v = vals(r); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const fmtV = (r: Row, v: number) => (r.key === "pot" || r.key === "stp" ? k(v) : String(Math.round(v)));

  // November 15 (Michael): six separate graphs, one per number, each with its title, average and target.
  return (
    <div className="space-y-4">
      {withWeight && <WeightRow days={days} goal={g.goalWeight} />}
      {shown.map((r) => {
        const a = avg(r), logged = vals(r).length, hit = vals(r).filter((v) => r.hit(v) === "hit").length;
        const target = r.goal ?? Math.max(1, ...vals(r)) / CAP; // no target yet (calories): against her highest day
        return (
          <div key={r.key}>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="flex items-center gap-1.5 font-[family-name:var(--font-display)] text-[13px] uppercase tracking-wide"><span className="size-2.5 rounded-sm" style={{ background: r.color }} />{r.label}</p>
              {r.key === "alc" ? (
                <p className="text-[12px] text-dim">
                  {(() => { const food = days.filter((d) => d.meals).length; return logged
                    ? <><b className="text-text">{logged}</b> of {food} days with a drink · avg <b className="text-text">{fmtV(r, a!)}</b> kcal on those days</>
                    : food ? <>No drinks logged in {food} days</> : <>Nothing logged</>; })()}
                </p>
              ) : (
                <p className="text-[12px] text-dim">
                  {r.goal ? <>Target <b className="text-text">{fmtV(r, r.goal)}{r.unit ? ` ${r.unit}` : ""}</b> · </> : r.key === "cal" ? <>No target yet · </> : null}
                  avg <b className="text-text">{a === null ? "–" : fmtV(r, a)}</b>
                  {logged ? (r.goal ? ` · ${hit} of ${logged} days on target` : ` · ${logged} days logged`) : " · nothing logged"}
                </p>
              )}
            </div>
            <div className="relative">
              {r.goal && <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[#7ee2a8]/50" style={{ top: H - H / CAP }} aria-hidden="true" />}
              <div className={`flex items-end ${days.length > 60 ? "gap-px" : "gap-[3px]"}`} style={{ height: H }}>
                {days.map((d) => {
                  const v = r.get(d);
                  // November 20 (Michael): a day with nothing logged gets a gray dash, so every day is visible.
                  if (v === null || v <= 0) return <span key={d.date} className="flex-1 border-b-2 border-[#4a4a4a]" title={`${d.date}: nothing logged`} />;
                  const st = r.hit(v);
                  return <span key={d.date} className="flex-1 rounded-t-[3px]" title={`${d.date}: ${r.key === "stp" ? Math.round(v).toLocaleString() : Math.round(v)} ${r.unit}`}
                    style={{ height: Math.max(3, (Math.min(v / target, CAP) / CAP) * H), background: st === "over" ? "#ef4444" : r.color, opacity: st === "under" ? 0.32 : 1 }} />;
                })}
              </div>
            </div>
            <Labels days={days} has={(d) => (r.get(d) ?? 0) > 0} />
          </div>
        );
      })}
    </div>
  );
}

/**
 * November 20 (Michael): the day labels under each chart: every day, easy to read. Up to a month: the weekday letter
 * over the date; up to ~3 months: the date only; longer: the month at the 1st and the date on Mondays.
 */
function Labels({ days, has }: { days: Daily["days"]; has: (d: Daily["days"][number]) => boolean }) {
  return (
    <div className={`mt-1 flex leading-tight ${days.length > 60 ? "gap-px" : "gap-[3px]"}`}>
      {days.map((d) => {
        const dom = Number(d.date.slice(8));
        const month = new Date(d.date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
        const monday = new Date(d.date + "T12:00:00Z").getUTCDay() === 1;
        const text = dom === 1 ? month : days.length > 100 ? (monday ? String(dom) : "") : String(dom);
        return (
          <span key={d.date} className={`flex-1 overflow-visible whitespace-nowrap text-center ${has(d) ? "text-[#d6d6d6]" : "text-[#6a6a6a]"} ${days.length > 60 ? "text-[8px]" : "text-[10px]"}`}>
            {days.length <= 31 && <span className="block font-semibold">{wk(d.date)}</span>}
            <span className="block">{text}</span>
          </span>
        );
      })}
    </div>
  );
}

/** November 20 (Michael): her weight on the same day-by-day timeline as the other charts (a dot on each weigh-in day). */
function WeightRow({ days, goal }: { days: Daily["days"]; goal: number | null }) {
  const H = 110;
  const ws = days.map((d) => d.weight).filter((w): w is number => w !== null);
  if (!ws.length) return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 font-[family-name:var(--font-display)] text-[13px] uppercase tracking-wide"><span className="size-2.5 rounded-sm bg-[#f5a623]" />Weight</p>
      <p className="text-[12px] text-dim">No weigh-ins in this time.</p>
    </div>
  );
  // Scaled to her own weigh-ins (at least a 4 lb window) so small changes show; the goal line only shows when it fits.
  const mid = (Math.min(...ws) + Math.max(...ws)) / 2, half = Math.max(2, (Math.max(...ws) - Math.min(...ws)) / 2 + 0.5);
  const lo = mid - half, hi = mid + half;
  const y = (v: number) => H - 8 - ((v - lo) / Math.max(1, hi - lo)) * (H - 16);
  const n = days.length, x = (i: number) => ((i + 0.5) / n) * 100;
  const pts = days.map((d, i) => (d.weight !== null ? { i, v: d.weight, date: d.date } : null)).filter((p): p is { i: number; v: number; date: string } => !!p);
  const first = pts[0], last = pts[pts.length - 1];
  const ch = first && last && first !== last ? Math.round((last.v - first.v) * 10) / 10 : null;
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="flex items-center gap-1.5 font-[family-name:var(--font-display)] text-[13px] uppercase tracking-wide"><span className="size-2.5 rounded-sm bg-[#f5a623]" />Weight</p>
        <p className="text-[12px] text-dim">latest <b className="text-text">{Math.round(last.v * 10) / 10} lbs</b>{ch !== null ? <> · <span className={ch < 0 ? "text-[#7ee2a8]" : ""}>{ch > 0 ? "+" : ""}{ch} lbs</span> in this time</> : ""} · {pts.length} of {n} days weighed{goal ? ` · goal ${goal}` : ""}</p>
      </div>
      <div className="relative" style={{ height: H }}>
        <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          {goal && goal >= lo && goal <= hi && <line x1="0" x2="100" y1={y(goal)} y2={y(goal)} stroke="#7ee2a8" strokeWidth="1" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" opacity="0.6" />}
          <path d={pts.map((p, k) => `${k ? "L" : "M"}${x(p.i)},${y(p.v)}`).join(" ")} fill="none" stroke="#f5a623" strokeWidth="1.5" vectorEffect="non-scaling-stroke" opacity="0.6" />
        </svg>
        {days.map((d, i) => d.weight === null
          ? <span key={d.date} className="absolute bottom-0 h-0.5 bg-[#4a4a4a]" style={{ left: `calc(${(i / n) * 100}% + 1px)`, width: `calc(${100 / n}% - 2px)` }} title={`${d.date}: no weigh-in`} />
          : <span key={d.date} className={`absolute ${n > 60 ? "size-1.5" : "size-2"} -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f5a623]`} style={{ left: `${x(i)}%`, top: y(d.weight) }} title={`${d.date}: ${d.weight} lbs`} />)}
      </div>
      <Labels days={days} has={(d) => d.weight !== null} />
    </div>
  );
}
