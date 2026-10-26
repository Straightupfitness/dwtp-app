"use client";
import { useState, useTransition } from "react";
import { setWorkoutDays } from "./actions";

const NAMES = ["S", "M", "T", "W", "T", "F", "S"], FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function WorkoutDays({ initial }: { initial: number[] }) {
  const [days, setDays] = useState(initial);
  const [pending, start] = useTransition();
  const toggle = (d: number) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d];
    setDays(next);
    start(() => setWorkoutDays(next));
  };
  return (
    <details className="group rounded-2xl border border-border bg-card">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-3.5">
        <span className="text-[14px]">Your workout days: <b>{days.length ? [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d)).map((d) => FULL[d].slice(0, 3)).join(", ") : "none yet"}</b></span>
        <span className="text-[13px] text-accent">{pending ? "Saving…" : "Change"}</span>
      </summary>
      <div className="flex justify-between gap-1 px-3.5 pb-3.5">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <button key={d} type="button" onClick={() => toggle(d)} aria-pressed={days.includes(d)} aria-label={FULL[d]}
            className={`grid size-11 place-items-center rounded-full border text-[14px] font-semibold ${days.includes(d) ? "border-accent bg-accent text-black" : "border-[#2a2a2a] text-dim"}`}>
            {NAMES[d]}
          </button>
        ))}
      </div>
    </details>
  );
}
