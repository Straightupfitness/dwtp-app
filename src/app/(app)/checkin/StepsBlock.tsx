"use client";

/**
 * Steps in the weekly check-in (October 28), instead of typing them in every day: her average a day this week,
 * straight from her phone or watch. She can say she doesn't track them.
 */
export default function StepsBlock({ value, onChange }: { value: string | undefined; onChange: (v: string) => void }) {
  const notTracked = value === "not tracked";
  return (
    <div className="space-y-3 rounded-[18px] border border-border bg-card p-4">
      <div>
        <p className="text-base font-semibold">Your steps this week</p>
        <p className="text-[13px] text-[#a8a8a8]">Your average a day. In the Health app, tap Steps, then W: it shows your daily average.</p>
      </div>
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="steps-avg">Average steps a day</label>
        <input id="steps-avg" inputMode="numeric" pattern="[0-9,]*" placeholder="e.g. 7,500" value={notTracked ? "" : value ?? ""}
          onChange={(e) => onChange(e.target.value.replace(/[^\d,]/g, ""))}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#2a2a2a] bg-bg px-3 text-lg outline-none focus:border-accent" />
        <button type="button" onClick={() => onChange(notTracked ? "" : "not tracked")} aria-pressed={notTracked}
          className={`min-h-11 shrink-0 rounded-xl px-3.5 text-sm ${notTracked ? "bg-accent font-semibold text-black" : "border border-[#2a2a2a]"}`}>I don&apos;t track</button>
      </div>
    </div>
  );
}
