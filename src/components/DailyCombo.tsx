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
  const H = 96, CAP = 1.5; // a bar at the dashed line = right on target; taller = over (capped at 1.5×)
  const vals = (r: Row) => days.map(r.get).filter((x): x is number => x !== null && x > 0);
  const avg = (r: Row) => { const v = vals(r); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const every = days.length > 200 ? 30 : days.length > 100 ? 14 : days.length > 45 ? 7 : days.length > 20 ? 3 : 1;
  const fmtV = (r: Row, v: number) => (r.key === "pot" || r.key === "stp" ? k(v) : String(Math.round(v)));

  // November 15 (Michael): six separate graphs, one per number, each with its title, average and target.
  return (
    <div className="space-y-4">
      {rows.map((r) => {
        const a = avg(r), logged = vals(r).length, hit = vals(r).filter((v) => r.hit(v) === "hit").length;
        const target = r.goal ?? Math.max(1, ...vals(r)) / CAP; // no target yet (calories): against her highest day
        return (
          <div key={r.key}>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="flex items-center gap-1.5 font-[family-name:var(--font-display)] text-[13px] uppercase tracking-wide"><span className="size-2.5 rounded-sm" style={{ background: r.color }} />{r.label}</p>
              <p className="text-[12px] text-dim">
                avg <b className="text-text">{a === null ? "–" : fmtV(r, a)}</b>{r.goal ? ` / ${fmtV(r, r.goal)}${r.unit ? ` ${r.unit}` : ""}` : r.key === "cal" ? " kcal · no target yet" : ""}
                {logged ? (r.goal ? ` · ${hit} of ${logged} days on target` : ` · ${logged} days logged`) : " · nothing logged"}
              </p>
            </div>
            <div className="relative">
              {r.goal && <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[#7ee2a8]/50" style={{ top: H - H / CAP }} aria-hidden="true" />}
              <div className={`flex items-end ${days.length > 60 ? "gap-px" : "gap-[3px]"}`} style={{ height: H }}>
                {days.map((d) => {
                  const v = r.get(d);
                  if (v === null || v <= 0) return <span key={d.date} className="flex-1" />;
                  const st = r.hit(v);
                  return <span key={d.date} className="flex-1 rounded-t-[3px]" title={`${d.date}: ${r.key === "stp" ? Math.round(v).toLocaleString() : Math.round(v)} ${r.unit}`}
                    style={{ height: Math.max(3, (Math.min(v / target, CAP) / CAP) * H), background: st === "over" ? "#ef4444" : r.color, opacity: st === "under" ? 0.32 : 1 }} />;
                })}
              </div>
            </div>
            <div className={`mt-0.5 flex text-[9px] text-dim ${days.length > 60 ? "gap-px" : "gap-[3px]"}`}>
              {days.map((d, i) => <span key={d.date} className="flex-1 overflow-visible whitespace-nowrap text-center">{i % every === 0 ? (every === 1 ? wk(d.date) : md(d.date)) : ""}</span>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
