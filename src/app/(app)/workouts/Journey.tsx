import { stageOf, type Phase } from "@/lib/workouts";

/**
 * Her whole program as one track: a segment per phase (sized by its weeks, in its stage's color), filled up to
 * the week she's on, a marker where she is, and the stages named underneath.
 */
export default function Journey({ phases, pweek, total, programName }: { phases: Phase[]; pweek: number; total: number; programName: string }) {
  if (!phases.length || !total) return null;
  const at = Math.min(Math.max(pweek, 0), total);           // weeks done or underway
  const pos = pweek < 1 ? 0 : Math.min(100, ((at - 0.5) / total) * 100);
  const groups: { label: string; color: string; weeks: number }[] = [];
  for (const ph of phases) {
    const st = stageOf(ph.stage, programName);
    const last = groups[groups.length - 1];
    if (last && last.label === st.label) last.weeks += ph.weeks; else groups.push({ label: st.label, color: st.color, weeks: ph.weeks });
  }
  const finished = pweek > total;
  return (
    <div className="rounded-[18px] border border-border bg-card px-4 pb-3 pt-3.5">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">Your journey</p>
        <p className="text-[13px] font-semibold tabular-nums">
          {finished ? "Program complete" : pweek < 1 ? `${total} weeks ahead` : <>Week {pweek} <span className="text-dim">of {total}</span></>}
        </p>
      </div>
      <div className="relative mt-4">
        {/* You are here */}
        {!finished && (
          <span className="absolute -top-[9px] z-10 -translate-x-1/2" style={{ left: `${pos}%` }} aria-hidden="true">
            <span className="block size-[18px] rounded-full border-[3px] border-[#121212] bg-white shadow-[0_0_0_2px_rgba(255,255,255,0.25)]" />
          </span>
        )}
        <div className="flex h-2 gap-[2px]" role="img" aria-label={pweek < 1 ? `Your program has ${total} weeks` : `Week ${Math.min(pweek, total)} of ${total}`}>
          {phases.map((ph) => {
            const st = stageOf(ph.stage, programName);
            const fill = Math.max(0, Math.min(1, (at - ph.first_week + 1) / ph.weeks));
            return (
              <span key={ph.id} className="relative overflow-hidden rounded-full" style={{ flexGrow: ph.weeks, flexBasis: 0, background: `color-mix(in srgb, ${st.color} 22%, #1c1c1c)` }}>
                <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${fill * 100}%`, background: st.color, opacity: ph.kind === "deload" ? 0.6 : 1 }} />
              </span>
            );
          })}
        </div>
      </div>
      {groups.length > 1 && (
        <div className="mt-2 flex gap-[2px]">
          {groups.map((g, i) => (
            <span key={i} className="min-w-0 pr-1 text-[10px] font-semibold uppercase leading-[1.15] tracking-[0.06em]" style={{ flexGrow: g.weeks, flexBasis: 0, color: g.color }}>{g.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}
