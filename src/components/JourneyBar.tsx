import { JOURNEY_DAYS, STAGES } from "@/lib/program";

/** Thin strip under the top bar on every tab: Day 3 of 182 and the Drained → Driven stages. */
export default function JourneyBar({ day, stage, startsIn }: { day: number; stage: number; startsIn: number }) {
  const label = startsIn > 0 ? `Starts ${startsIn === 1 ? "tomorrow" : `in ${startsIn} days`}`
    : day > JOURNEY_DAYS ? `Day ${day}` : `Day ${day} of ${JOURNEY_DAYS}`;
  return (
    <div className="mx-auto flex h-9 max-w-md items-center gap-3 px-4">
      <p className="shrink-0 font-[family-name:var(--font-display)] text-[13px] uppercase tracking-wide">
        {label}<span className="text-accent"> · {STAGES[stage].label}</span>
      </p>
      <ol className="grid flex-1 grid-cols-4 gap-1" aria-label={`Stage ${stage + 1} of 4: ${STAGES[stage].label}`}>
        {STAGES.map((s, i) => {
          // How far through this stage she is (Drained is done the day she starts).
          const fill = i < stage ? 1 : i > stage ? 0
            : s.key === "drained" ? 0.5
            : Math.min(1, (day - s.from + 1) / ((Number.isFinite(s.to) ? s.to : JOURNEY_DAYS) - s.from + 1));
          return (
            <li key={s.key} className="h-1.5 rounded-full bg-[#262626]" title={s.label}>
              <span className="block h-1.5 rounded-full bg-accent" style={{ width: `${Math.round(fill * 100)}%` }} />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
