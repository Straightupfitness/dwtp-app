"use client";
import { useOptimistic, useTransition } from "react";
import { IconWater } from "@/components/Icons";
import { addWater } from "./actions";

const display = "font-[family-name:var(--font-display)] uppercase";

/** Today's water: one tap per glass or bottle, toward her goal (1 gallon = 128 oz). */
export default function WaterCard({ oz, goal }: { oz: number; goal: number }) {
  const [shown, add] = useOptimistic(oz, (s, d: number) => Math.max(0, s + d));
  const [, start] = useTransition();
  const tap = (d: number) => start(async () => { add(d); await addWater(d); });
  const pct = Math.min(1, shown / goal);
  const hit = shown >= goal;
  return (
    <div className="space-y-2.5 rounded-2xl border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className={`${display} flex items-center gap-1.5 text-[17px] font-medium leading-none`}><span className="text-[#38bdf8]"><IconWater /></span>Today&apos;s water</p>
        <p className="text-[12px] text-dim">{hit ? <span className="text-[#7ee2a8]">Goal hit</span> : `${goal - shown} oz to go`}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`${display} shrink-0 text-[26px] leading-none tabular-nums`}>{shown} <span className="text-[12px] normal-case text-dim">/ {goal} oz</span></span>
        <span className="h-2 flex-1 rounded-full bg-[#1d2a33]" aria-hidden="true"><span className="block h-2 rounded-full bg-[#38bdf8] transition-all" style={{ width: `${pct * 100}%` }} /></span>
      </div>
      <div className="flex gap-2">
        {[8, 16, 32].map((d) => (
          <button key={d} type="button" onClick={() => tap(d)} className="min-h-11 flex-1 rounded-lg border border-[#244456] bg-[#0f1c24] text-[14px] font-semibold text-[#9bdcff]">+{d} oz</button>
        ))}
        <button type="button" onClick={() => tap(-8)} disabled={shown <= 0} aria-label="Take back 8 oz" className="min-h-11 rounded-lg border border-[#2a2a2a] px-3 text-[14px] text-dim disabled:opacity-40">−8</button>
      </div>
    </div>
  );
}
