import type { Guarantee } from "@/lib/guarantee";

/** 15 Pound Guarantee tracker (November 6). Michael only; she never sees this. */
export default function GuaranteeCard({ g }: { g: Guarantee | null }) {
  if (!g) return null;
  const bar = (v: number | null) => (
    <span className="relative block h-2 overflow-hidden rounded-full bg-[#262626]">
      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, v ?? 0)}%`, background: v === null ? "#444" : v >= 80 ? "#22c55e" : v >= 70 ? "#f5a623" : "#ef4444" }} />
      <span className="absolute inset-y-0 w-px bg-white/60" style={{ left: "80%" }} aria-hidden="true" />
    </span>
  );
  const status = g.onTrack === null ? { t: g.started ? "Too early to tell" : "Starts with her program", c: "text-dim" }
    : g.onTrack ? { t: "On track", c: "text-[#7ee2a8]" } : { t: "At risk", c: "text-[#fb7185]" };
  return (
    <section className="space-y-3 rounded-[18px] border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm uppercase tracking-widest text-dim">15 Pound Guarantee · only you see this</h2>
        <span className={`text-[13px] font-semibold ${status.c}`}>{status.t}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="flex justify-between text-[13px]"><span>Habits</span><b>{g.habits.pct === null ? "–" : `${g.habits.pct}%`}</b></p>
          {bar(g.habits.pct)}
          <p className="text-[11px] text-dim">{g.habits.done} of {g.habits.due} habit-days done (needs 80%)</p>
        </div>
        <div className="space-y-1">
          <p className="flex justify-between text-[13px]"><span>Check-ins</span><b>{g.checkins.pct === null ? "–" : `${g.checkins.pct}%`}</b></p>
          {bar(g.checkins.pct)}
          <p className="text-[11px] text-dim">{g.checkins.done} of {g.checkins.due} weeks{g.checkins.missed.length ? ` · missed week ${g.checkins.missed.join(", ")}` : ""} (needs 80%)</p>
        </div>
      </div>
      <p className="text-[12px] text-[#a8a8a8]">Bad weeks used: <b className="text-text">{g.badWeeks.length} of 3</b>{g.badWeeks.length ? ` (week ${g.badWeeks.join(", ")})` : ""}. They count as complete. Measured across the 26 weeks; week {Math.max(0, Math.min(26, g.week))} of 26 now.</p>
    </section>
  );
}
