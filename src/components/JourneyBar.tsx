import FitWidth from "./FitWidth";

/** One color per stage, from tired gray to Driven gold. */
export const STAGE_COLORS = ["#94a3b8", "#818cf8", "#22c55e", "#f5a623"] as const;
export const JOURNEY_WEEKS = 26;
/** Drained is where she starts (no weeks). Rested begins in Week 1. */
const PHASES = [
  { label: "Rested", from: 1, to: 4, color: STAGE_COLORS[1] },
  { label: "Fueled", from: 5, to: 16, color: STAGE_COLORS[2] },
  { label: "Driven", from: 17, to: 26, color: STAGE_COLORS[3] },
];

const Arrow = () => (
  <svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="#6b6b6b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mx-1 mt-px shrink-0">
    <path d="M1.5 4h8M7 1.5L9.5 4 7 6.5" />
  </svg>
);

/** Under the top bar on every tab: the date, Week 1 of 26, and Drained → Rested → Fueled → Driven with a mark per week. */
export default function JourneyBar({ day, startsIn, date }: { day: number; stage: number; startsIn: number; date: string }) {
  const week = startsIn > 0 ? 0 : Math.ceil(day / 7);
  const big = startsIn > 0 ? `Starts ${startsIn === 1 ? "tomorrow" : `in ${startsIn} days`}`
    : week > JOURNEY_WEEKS ? `Week ${week}` : `Week ${week} of ${JOURNEY_WEEKS}`;
  const current = PHASES.find((p) => week >= p.from && week <= p.to);
  return (
    <div className="mx-auto max-w-md px-4 pt-3">
      <FitWidth top={date} big={big} className="font-[family-name:var(--font-display)] uppercase tracking-wide" />
      <div className="mt-2 flex items-start" role="img"
        aria-label={week ? `Week ${week} of ${JOURNEY_WEEKS}, in the ${current?.label ?? "Driven"} phase` : "Drained: your program hasn't started yet"}>
        <span className="text-[10px] font-semibold uppercase leading-[8px] tracking-[0.1em]" style={{ color: STAGE_COLORS[0] }}>Drained</span>
        {PHASES.map((p) => {
          const n = p.to - p.from + 1;
          const here = current === p;
          return (
            <div key={p.label} className="flex items-start" style={{ flex: `${n} 1 0` }}>
              <Arrow />
              <div className="flex-1">
                <div className="flex gap-[2px]">
                  {Array.from({ length: n }, (_, i) => {
                    const w = p.from + i;
                    return <span key={w} className="h-2 flex-1 first:rounded-l-full last:rounded-r-full"
                      style={{ background: p.color, opacity: w <= week ? 1 : week >= p.from ? 0.3 : 0.18 }} />;
                  })}
                </div>
                <span className={`mt-1 block text-[10px] uppercase tracking-[0.1em] ${here ? "font-semibold" : ""}`}
                  style={{ color: p.color, opacity: week >= p.from ? 1 : 0.45 }}>{p.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
