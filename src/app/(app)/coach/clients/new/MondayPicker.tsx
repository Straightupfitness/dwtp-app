"use client";
import { useState } from "react";

const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
const label = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Program start: a calendar picker, plus the next Mondays as one-tap buttons (the program always starts on a Monday). */
export default function MondayPicker({ defaultValue, className }: { defaultValue: string; className: string }) {
  const [value, setValue] = useState(defaultValue);
  const mondays = Array.from({ length: 6 }, (_, i) => addDays(defaultValue, i * 7));
  const notMonday = !!value && new Date(value + "T12:00:00Z").getUTCDay() !== 1;
  return (
    <div className="space-y-1.5 text-sm text-dim sm:col-span-2">
      <label htmlFor="program_start">Program start (a Monday)</label>
      <input id="program_start" name="program_start" type="date" value={value} onChange={(e) => setValue(e.target.value)}
        className={`${className} [color-scheme:dark]`} />
      <div className="flex flex-wrap gap-1.5">
        {mondays.map((m) => (
          <button key={m} type="button" onClick={() => setValue(m)} aria-pressed={value === m}
            className={`min-h-9 rounded-full border px-3 text-[13px] ${value === m ? "border-accent bg-accent font-semibold text-black" : "border-[#2a2a2a] text-text"}`}>
            Mon {label(m)}
          </button>
        ))}
        <button type="button" onClick={() => setValue("")} className="min-h-9 rounded-full px-2 text-[13px] text-dim">No date yet</button>
      </div>
      {notMonday && <p className="text-xs text-[var(--red)]">That&apos;s not a Monday. The program always starts on a Monday.</p>}
    </div>
  );
}
