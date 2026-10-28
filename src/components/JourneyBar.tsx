/** One color per stage, from tired gray to Driven gold. */
export const STAGE_COLORS = ["#94a3b8", "#818cf8", "#22c55e", "#f5a623"] as const;
export const JOURNEY_WEEKS = 26;
/** Drained is where she starts (no weeks). Rested begins in Week 1. */
const PHASES = [
  { label: "Rested", from: 1, to: 4, color: STAGE_COLORS[1] },
  { label: "Fueled", from: 5, to: 16, color: STAGE_COLORS[2] },
  { label: "Driven", from: 17, to: 26, color: STAGE_COLORS[3] },
];

export const journeyWeek = (day: number, startsIn: number) => (startsIn > 0 ? 0 : Math.ceil(day / 7));

/**
 * Rested → Fueled → Driven as one track, in the same style as the Workouts journey (October 28): each stage in its
 * color (faint until she gets there), filled up to her week, a white dot where she is, every stage named underneath.
 */
export default function StageBars({ week }: { week: number }) {
  const current = PHASES.find((p) => week >= p.from && week <= p.to);
  const at = Math.min(Math.max(week, 0), JOURNEY_WEEKS);
  const pos = week < 1 ? 0 : Math.min(100, ((at - 0.5) / JOURNEY_WEEKS) * 100);
  return (
    <div role="img" aria-label={week ? `Week ${week} of ${JOURNEY_WEEKS}, in the ${current?.label ?? "Driven"} stage` : "Drained: your program hasn't started yet"}>
      <div className="relative pt-[5px]">
        {week <= JOURNEY_WEEKS && (
          <span className="absolute -top-1 z-10 -translate-x-1/2" style={{ left: `${pos}%` }} aria-hidden="true">
            <span className="block size-[18px] rounded-full border-[3px] border-[#121212] bg-white shadow-[0_0_0_2px_rgba(255,255,255,0.25)]" />
          </span>
        )}
        <div className="flex h-2 gap-[2px]">
          {PHASES.map((p) => {
            const n = p.to - p.from + 1;
            const fill = Math.max(0, Math.min(1, (at - p.from + 1) / n));
            return (
              <span key={p.label} className="relative overflow-hidden rounded-full" style={{ flexGrow: n, flexBasis: 0, background: `color-mix(in srgb, ${p.color} 22%, #1c1c1c)` }}>
                <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${fill * 100}%`, background: p.color }} />
              </span>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex gap-[2px]">
        {PHASES.map((p) => (
          <span key={p.label} className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ flexGrow: p.to - p.from + 1, flexBasis: 0, color: p.color }}>{p.label}</span>
        ))}
      </div>
    </div>
  );
}
