import type { Daily } from "@/lib/daily";

const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));
const md = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "numeric", day: "numeric", timeZone: "UTC" });
const wk = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "narrow", timeZone: "UTC" });

/**
 * November 15 (Michael): food, water and steps in one chart. One group of bars per day: calories, protein, fiber,
 * potassium, water, steps. A bar is solid when she hit the target and faded when she was under it; calories over
 * the target are red. The dashed line is the target (every bar is drawn against its own target). Averages on the left.
 */
export default function DailyCombo({ days, goals }: { days: Daily["days"]; goals: Daily["goals"] }) {
  const g = goals;
  type Row = { key: string; label: string; color: string; unit: string; goal: number | null; get: (d: Daily["days"][number]) => number | null; hit: (v: number) => "hit" | "under" | "over" };
  const rows: Row[] = [
    { key: "cal", label: "Calories", color: "#f5a623", unit: "kcal", goal: g.calories || null, get: (d) => (d.meals ? d.calories : null),
      hit: (v) => (!g.calories ? "hit" : v > g.calories + 100 ? "over" : v >= g.calories - 100 ? "hit" : "under") },
    { key: "pro", label: "Protein", color: "#f97316", unit: "g", goal: g.protein, get: (d) => (d.meals ? d.protein : null), hit: (v) => (v >= g.protein - 10 ? "hit" : "under") },
    { key: "fib", label: "Fiber", color: "#22c55e", unit: "g", goal: g.fiber, get: (d) => (d.meals ? d.fiber : null), hit: (v) => (v >= g.fiber - 5 ? "hit" : "under") },
    { key: "pot", label: "Potassium", color: "#c084fc", unit: "mg", goal: g.potassium, get: (d) => (d.meals ? d.potassium : null), hit: (v) => (v >= g.potassium - 500 ? "hit" : "under") },
    { key: "wat", label: "Water", color: "#38bdf8", unit: "oz", goal: g.water, get: (d) => d.water ?? null, hit: (v) => (v >= g.water ? "hit" : "under") },
    { key: "stp", label: "Steps", color: "#a3e635", unit: "", goal: g.steps, get: (d) => d.steps ?? null, hit: (v) => (v >= g.steps ? "hit" : "under") },
  ];
  const H = 230, CAP = 1.5; // a bar at the dashed line = right on target; taller = over (capped at 1.5×)
  const avg = (r: Row) => { const v = days.map(r.get).filter((x): x is number => x !== null && x > 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const onTarget = (r: Row) => days.map(r.get).filter((x): x is number => x !== null && x > 0).filter((v) => r.hit(v) === "hit").length;
  const logged = (r: Row) => days.map(r.get).filter((x) => x !== null && x > 0).length;
  const every = days.length > 45 ? 7 : days.length > 20 ? 3 : 1;

  return (
    <div className="flex items-start gap-3">
      <ul className="w-[8.5rem] shrink-0 space-y-1.5 text-[12px]">
        {rows.map((r) => {
          const a = avg(r);
          return (
            <li key={r.key} className="leading-tight">
              <span className="flex items-center gap-1.5"><span className="size-2.5 shrink-0 rounded-sm" style={{ background: r.color }} /><span className="text-dim">{r.label}</span></span>
              <span className="block pl-4"><b className="text-text">{a === null ? "–" : r.key === "pot" || r.key === "stp" ? k(a) : Math.round(a)}</b>
                <span className="text-dim">{r.goal ? ` / ${r.key === "pot" || r.key === "stp" ? k(r.goal) : r.goal}${r.unit ? ` ${r.unit}` : ""}` : r.key === "cal" ? " kcal · no target yet" : ""}</span></span>
              <span className="block pl-4 text-[10px] text-dim">{!logged(r) ? "nothing logged" : r.goal ? `${onTarget(r)} of ${logged(r)} days on target` : `${logged(r)} days logged`}</span>
            </li>
          );
        })}
      </ul>
      <div className="min-w-0 flex-1 overflow-x-auto pb-1">
        <div className="relative" style={{ minWidth: days.length * 26 }}>
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[#7ee2a8]/60" style={{ top: H - H / CAP }} aria-hidden="true" />
          <div className="flex items-end gap-[3px]" style={{ height: H }}>
            {days.map((d) => (
              <div key={d.date} className="flex h-full flex-1 items-end justify-center gap-px" title={d.date}>
                {rows.map((r) => {
                  const v = r.get(d);
                  if (v === null || v <= 0) return <span key={r.key} className="w-[3px]" />;
                  const st = r.hit(v);
                  // No target yet (calories before Michael sets one): drawn against her highest day instead.
                  const target = r.goal ?? Math.max(1, ...days.map(r.get).filter((x): x is number => x !== null)) / CAP;
                  const h = (Math.min(v / target, CAP) / CAP) * H;
                  return <span key={r.key} className="w-[3px] rounded-t-[1px]" title={`${r.label}: ${r.key === "stp" ? Math.round(v).toLocaleString() : Math.round(v)} ${r.unit}`}
                    style={{ height: Math.max(2, h), background: st === "over" ? "#ef4444" : r.color, opacity: st === "under" ? 0.32 : 1 }} />;
                })}
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-[3px] text-[9px] text-dim">
            {days.map((d, i) => <span key={d.date} className="flex-1 text-center">{i % every === 0 ? (every === 1 ? wk(d.date) : md(d.date)) : ""}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}
