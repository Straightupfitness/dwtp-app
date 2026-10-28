/**
 * Where she is in this phase (October 28): one block per week of the phase, one pip per workout in that week.
 * Done workouts fill in with the stage color; a white dot sits on her next workout. No program-wide week number,
 * so it never competes with "Week 2 of 26" on Today.
 */
export default function PhaseCard({ stage, kindLabel, kindNote, name, weeks, weekOfPhase, perWeek, doneByWeek, next, intro }: {
  stage: { label: string; color: string; tint: string };
  kindLabel: string; kindNote: string; name: string;
  weeks: number; weekOfPhase: number; perWeek: number;
  doneByWeek: number[];   // workouts done in each week of the phase
  next: number | null;    // index of her next workout this week (null when the week is done)
  intro?: React.ReactNode;
}) {
  const doneNow = doneByWeek[weekOfPhase - 1] ?? 0;
  const status = perWeek === 0 ? null : next === null ? `All ${perWeek} done this week` : `Workout ${next + 1} of ${perWeek}`;
  return (
    <div className="relative overflow-hidden rounded-[20px] border border-border p-4" style={{ background: `linear-gradient(135deg, ${stage.tint} 0%, #121212 70%)` }}>
      <svg className="pointer-events-none absolute -right-6 -top-6 opacity-[0.12]" width="150" height="150" viewBox="0 0 24 24" fill="none" stroke={stage.color} strokeWidth="1.4" aria-hidden="true">
        <path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" strokeLinecap="round" />
      </svg>
      {intro}
      <div className="flex items-center gap-2">
        <span className="rounded-full px-2.5 py-1 text-[11px] font-bold tracking-[0.12em] text-black" style={{ background: stage.color }}>{stage.label}</span>
        <span className="text-[12px] uppercase tracking-[0.12em] text-[#bdbdbd]">{kindLabel}</span>
      </div>
      <p className="mt-2 font-[family-name:var(--font-display)] text-[28px] uppercase leading-none">{name}</p>
      <p className="mt-1.5 text-[13px] font-semibold uppercase tracking-[0.1em]">
        Week {weekOfPhase} <span className="text-[#9a9a9a]">of {weeks}</span>{status && <><span className="text-[#6b6b6b]"> · </span>{status}</>}
      </p>

      {/* One block per week, one pip per workout. */}
      <div className="mt-3 flex gap-2.5" role="img" aria-label={`Week ${weekOfPhase} of ${weeks} in this phase${status ? `, ${status.toLowerCase()}` : ""}`}>
        {Array.from({ length: weeks }, (_, wi) => {
          const w = wi + 1, done = doneByWeek[wi] ?? 0, now = w === weekOfPhase;
          return (
            <div key={w} className="min-w-0 flex-1">
              <div className="relative flex h-2 gap-[3px]">
                {Array.from({ length: Math.max(1, perWeek) }, (_, i) => {
                  const filled = perWeek ? (now ? i < doneNow : i < done) : w < weekOfPhase;
                  const here = now && next === i;
                  return (
                    <span key={i} className="relative flex-1 rounded-full" style={{ background: filled ? stage.color : `color-mix(in srgb, ${stage.color} 22%, #1c1c1c)` }}>
                      {here && <span className="absolute left-1/2 top-1/2 z-10 block size-[16px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#121212] bg-white shadow-[0_0_0_2px_rgba(255,255,255,0.25)]" />}
                    </span>
                  );
                })}
              </div>
              <p className={`mt-2 text-[10px] uppercase tracking-[0.1em] ${now ? "font-semibold text-text" : "text-[#8a8a8a]"}`}>Week {w}</p>
            </div>
          );
        })}
      </div>
      <p className="mt-2.5 text-[13px] leading-snug text-[#d4d4d4]">{kindNote}</p>
    </div>
  );
}
