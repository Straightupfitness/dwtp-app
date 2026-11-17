"use client";
import { useState, useTransition } from "react";
import { INTENSITY_INFO, type Intensity } from "@/lib/cycle";
import { saveDayLog } from "@/app/(app)/cycle/actions";

/** November 17: on the workout's start screen, she picks how hard she goes today (the app suggests one). */
export default function IntensityPick({ suggested, why, chosen, onChange, preview = false }: { suggested: Intensity; why: string; chosen: Intensity | null; onChange: (i: Intensity) => void; preview?: boolean }) {
  const [pick, setPick] = useState<Intensity>(chosen ?? suggested);
  const [, start] = useTransition();
  return (
    <div className="space-y-2 rounded-[16px] border border-border bg-card p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">How hard today?</p>
      <div className="grid grid-cols-3 gap-1.5">
        {(["heavy", "normal", "lighter"] as Intensity[]).map((i) => (
          <button key={i} type="button" aria-pressed={pick === i} onClick={() => { setPick(i); onChange(i); if (!preview) start(async () => { await saveDayLog({ intensity: i }); }); }}
            className={`min-h-12 rounded-xl border text-[13px] font-semibold ${pick === i ? "border-accent bg-accent text-black" : "border-border text-text"}`}>
            {INTENSITY_INFO[i].icon} {INTENSITY_INFO[i].label}{i === suggested && <span className={`block text-[10px] font-normal ${pick === i ? "text-black/70" : "text-dim"}`}>suggested</span>}
          </button>
        ))}
      </div>
      <p className="text-[12px] leading-snug text-dim">{pick === suggested ? `${why} ` : ""}{INTENSITY_INFO[pick].tip}</p>
    </div>
  );
}
