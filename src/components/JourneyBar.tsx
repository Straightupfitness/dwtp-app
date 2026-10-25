import { JOURNEY_DAYS, STAGES } from "@/lib/program";

/** One color per stage, from tired gray to Driven gold. */
export const STAGE_COLORS = ["#94a3b8", "#818cf8", "#22c55e", "#f5a623"] as const;

/** Under the top bar on every tab: the date, Day 21 of 182, and Drained → Rested → Fueled → Driven. */
export default function JourneyBar({ day, stage, startsIn, date }: { day: number; stage: number; startsIn: number; date: string }) {
  const label = startsIn > 0 ? `Starts ${startsIn === 1 ? "tomorrow" : `in ${startsIn} days`}`
    : day > JOURNEY_DAYS ? `Day ${day}` : `Day ${day} of ${JOURNEY_DAYS}`;
  return (
    <div className="mx-auto max-w-md px-4 pt-3">
      <p className="text-[11px] uppercase tracking-[0.15em] text-accent">{date}</p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-[15px] uppercase tracking-wide">
        {label}<span style={{ color: STAGE_COLORS[stage] }}> · {STAGES[stage].label}</span>
      </p>
      <ol className="mt-2 flex items-start" aria-label={`Stage ${stage + 1} of 4: ${STAGES[stage].label}`}>
        {STAGES.map((s, i) => {
          const reached = i <= stage;
          return (
            <li key={s.key} className="flex flex-1 items-start" aria-current={i === stage ? "step" : undefined}>
              <span className="flex-1">
                <span className="block h-2 rounded-full" style={{ background: STAGE_COLORS[i], opacity: reached ? 1 : 0.22 }} />
                <span className={`mt-1 block text-[10px] uppercase tracking-[0.1em] ${i === stage ? "font-semibold" : ""}`}
                  style={{ color: STAGE_COLORS[i], opacity: reached ? 1 : 0.45 }}>{s.label}</span>
              </span>
              {i < STAGES.length - 1 && (
                <svg width="14" height="8" viewBox="0 0 14 8" fill="none" stroke="#6b6b6b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mx-0.5 shrink-0">
                  <path d="M2 4h9M8.5 1.5L11 4 8.5 6.5" />
                </svg>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
