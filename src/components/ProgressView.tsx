import Link from "next/link";
import type { Daily } from "@/lib/daily";
import type { BadgeStatus } from "@/lib/badges";
import { DayBars, WeightLine } from "./Charts";
import BadgeIcon from "./BadgeIcon";

const display = "font-[family-name:var(--font-display)] uppercase";
const card = "rounded-[18px] border border-border bg-card p-4";
const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));
const short = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

function H({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return <div className="flex items-baseline justify-between gap-2"><h2 className={`${display} text-lg`}>{children}</h2>{right}</div>;
}

function Goal({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="rounded-[14px] border border-border bg-[#141414] p-3">
      <p className="text-[11px] uppercase tracking-[0.1em] text-dim">{label}</p>
      <p className={`${display} mt-1 text-[22px] leading-none`}>{value}{unit && <span className="ml-1 text-[13px] normal-case text-dim">{unit}</span>}</p>
      {sub && <p className="mt-1 text-[11px] text-[#a8a8a8]">{sub}</p>}
    </div>
  );
}

/**
 * Everything she's done, on one screen (October 29): her goals, weight, food (calories, protein, fiber, potassium),
 * steps and water day by day, and her badges. Michael sees the same view on each client's page.
 */
export default function ProgressView({ data, badges, range, base, coach = false }: {
  data: Daily; badges: BadgeStatus[]; range: number; base: string; coach?: boolean;
}) {
  const g = data.goals;
  const days = data.days.slice(-range);
  const last = data.weights[data.weights.length - 1] ?? null;
  const lost = g.startWeight && last ? Math.round((g.startWeight - last.lbs) * 10) / 10 : null;
  const series = (f: (d: (typeof days)[number]) => number | null) => days.map((d) => ({ date: d.date, value: f(d) }));
  const hasSteps = days.some((d) => d.steps);
  const she = coach ? "She" : "You";

  return (
    <div className="space-y-4">
      <nav className="flex gap-1 rounded-[14px] border border-border bg-card p-1" aria-label="How far back">
        {[14, 30, 90].map((r) => (
          <Link key={r} href={`${base}${base.includes("?") ? "&" : "?"}r=${r}${coach ? "#progress" : ""}`} aria-current={range === r ? "page" : undefined}
            className={`grid min-h-10 flex-1 place-items-center rounded-[10px] text-[13px] ${range === r ? "bg-accent font-semibold text-black" : "text-dim"}`}>{r} days</Link>
        ))}
      </nav>

      <section className="space-y-2.5">
        <H>{coach ? "Her goals" : "Your goals"}</H>
        <div className="grid grid-cols-2 gap-2">
          <Goal label="Weight" value={g.goalWeight ? String(g.goalWeight) : "–"} unit={g.goalWeight ? "lbs" : undefined} sub={g.startWeight ? `Started at ${g.startWeight} lbs` : undefined} />
          <Goal label="Calories a day" value={g.calories ? g.calories.toLocaleString() : "Coming"} sub={g.calories ? "Within 100 counts as on target" : "Michael sets it after 14 days of logging"} />
          <Goal label="Protein a day" value={String(g.protein)} unit="g" sub="40 g+ at every meal" />
          <Goal label="Fiber a day" value={String(g.fiber)} unit="g" />
          <Goal label="Potassium a day" value={g.potassium.toLocaleString()} unit="mg" />
          <Goal label="Water a day" value={String(g.water)} unit="oz" sub={g.water === 128 ? "1 gallon" : undefined} />
          <Goal label="Steps a day" value={g.steps.toLocaleString()} />
        </div>
      </section>

      <section className={`${card} space-y-3`}>
        <H right={lost !== null && lost !== 0 ? <span className={`text-[13px] font-semibold ${lost > 0 ? "text-[#7ee2a8]" : "text-[#a8a8a8]"}`}>{lost > 0 ? `−${lost}` : `+${-lost}`} lbs since the start</span> : null}>Weight</H>
        {last && <p className="text-[13px] text-[#a8a8a8]">Latest <b className="text-text">{last.lbs} lbs</b> on {short(last.date)}{g.goalWeight ? ` · ${Math.abs(Math.round((last.lbs - g.goalWeight) * 10) / 10)} lbs to goal` : ""}</p>}
        <WeightLine points={data.weights} goal={g.goalWeight} />
        {data.weights.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer list-none text-[13px] font-semibold text-accent">Every weigh-in ({data.weights.length}) <span className="inline-block transition group-open:rotate-180">⌄</span></summary>
            <ul className="mt-2 max-h-64 divide-y divide-border overflow-y-auto rounded-xl border border-border text-[14px]">
              {[...data.weights].reverse().map((w, i, a) => {
                const prev = a[i + 1];
                const ch = prev ? Math.round((w.lbs - prev.lbs) * 10) / 10 : null;
                return (
                  <li key={w.date} className="flex justify-between px-3 py-2">
                    <span className="text-[#a8a8a8]">{short(w.date)}</span>
                    <span><b>{w.lbs}</b> lbs{ch !== null && ch !== 0 && <span className={`ml-2 text-[12px] ${ch < 0 ? "text-[#7ee2a8]" : "text-dim"}`}>{ch > 0 ? "+" : "−"}{Math.abs(ch)}</span>}</span>
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </section>

      <section className={`${card} space-y-4`}>
        <H>Food, day by day</H>
        <div><p className="mb-1 text-[13px] font-semibold">Calories</p>
          <DayBars days={series((d) => (d.meals ? d.calories : null))} color="#f5a623" unit="kcal" goal={g.calories} band={g.calories ? [g.calories - 100, g.calories + 100] : null} /></div>
        <div><p className="mb-1 text-[13px] font-semibold">Protein</p>
          <DayBars days={series((d) => (d.meals ? d.protein : null))} color="#f97316" unit="g" goal={g.protein} band={[g.protein - 10, g.protein + 10]} /></div>
        <div><p className="mb-1 text-[13px] font-semibold">Fiber</p>
          <DayBars days={series((d) => (d.meals ? d.fiber : null))} color="#22c55e" unit="g" goal={g.fiber} band={[g.fiber - 5, g.fiber + 5]} /></div>
        <div><p className="mb-1 text-[13px] font-semibold">Potassium</p>
          <DayBars days={series((d) => (d.meals ? d.potassium : null))} color="#c084fc" unit="mg" goal={g.potassium} band={[g.potassium - 500, g.potassium + 500]} fmt={k} /></div>
        <p className="text-[11px] text-dim">Shaded band = on target. Dashed line = {coach ? "her" : "your"} goal.</p>
      </section>

      <section className={`${card} space-y-4`}>
        <div><H>Water</H>
          <div className="mt-2"><DayBars days={series((d) => d.water)} color="#38bdf8" unit="oz" goal={g.water} /></div></div>
        <div><H>Steps</H>
          <div className="mt-2">{hasSteps
            ? <DayBars days={series((d) => d.steps)} color="#a3e635" unit="steps" goal={g.steps} />
            : <p className="text-[13px] text-dim">{coach ? "Her steps show here once her iPhone syncs them (Shortcut under Account)." : "Your steps show here once your iPhone syncs them. Set it up under Account → Apple Health. You also report your weekly average in your check-in."}</p>}</div></div>
      </section>

      <section className={`${card} space-y-3`}>
        <H right={<span className="text-[12px] text-dim">{badges.filter((b) => b.earned).length} of {badges.length} earned</span>}>Badges</H>
        <ul className="grid grid-cols-1 gap-2">
          {badges.map((b) => (
            <li key={b.def.key} className="flex items-center gap-3 rounded-[14px] border border-border bg-[#141414] p-2.5">
              <BadgeIcon badge={b.def.key} size={48} earned={b.earned} progress={b.current / b.goal} />
              <span className="min-w-0 flex-1">
                <span className={`${display} block text-[16px] leading-tight`} style={{ color: b.earned ? b.def.color : undefined }}>{b.def.name}</span>
                <span className="block text-[12px] leading-snug text-[#a8a8a8]">{b.def.rule}</span>
              </span>
              <span className="shrink-0 text-right text-[12px]">
                {b.earned ? <span className="font-semibold text-[#7ee2a8]">Earned</span> : <><b className="text-text">{Math.min(b.current, b.goal)}</b><span className="text-dim">/{b.goal} {b.unit}</span></>}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-dim">{she} keep{coach ? "s" : ""} a badge for good once it&apos;s earned. Earned badges show next to {coach ? "her" : "your"} name in Community.</p>
      </section>

      <details className={`${card} group`}>
        <summary className={`${display} cursor-pointer list-none text-lg`}>Every day, in numbers <span className="inline-block text-dim transition group-open:rotate-180">⌄</span></summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-right text-[12px] tabular-nums">
            <thead className="text-dim"><tr><th className="py-1 text-left font-normal">Day</th><th className="font-normal">kcal</th><th className="font-normal">Prot</th><th className="font-normal">Fib</th><th className="font-normal">K</th><th className="font-normal">Water</th><th className="font-normal">Steps</th><th className="font-normal">lbs</th></tr></thead>
            <tbody className="divide-y divide-border">
              {[...days].reverse().map((d) => (
                <tr key={d.date}>
                  <td className="py-1.5 text-left text-[#a8a8a8]">{short(d.date).replace(/,.*$/, "")} {d.date.slice(5).replace("-", "/")}</td>
                  <td>{d.meals ? d.calories : "–"}</td><td>{d.meals ? d.protein : "–"}</td><td>{d.meals ? d.fiber : "–"}</td><td>{d.meals ? k(d.potassium) : "–"}</td>
                  <td>{d.water ?? "–"}</td><td>{d.steps ? k(d.steps) : "–"}</td><td>{d.weight ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
