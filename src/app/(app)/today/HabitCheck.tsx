"use client";
import { useOptimistic, useTransition } from "react";
import { toggleHabit } from "./actions";

export default function HabitCheck({ itemId, date, done, title, detail, streak, target }: {
  itemId: string; date: string; done: boolean; title: string; detail?: string | null; streak: number; target: number;
}) {
  const [optimistic, setOptimistic] = useOptimistic(done);
  const [, start] = useTransition();
  return (
    <button
      onClick={() => start(async () => { setOptimistic(!optimistic); await toggleHabit(itemId, date, !optimistic); })}
      aria-pressed={optimistic}
      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${optimistic ? "border-accent bg-accent/10" : "border-border bg-card"}`}>
      <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 ${optimistic ? "border-accent bg-accent text-black" : "border-dim"}`}>
        {optimistic ? "✓" : ""}
      </span>
      <span className="flex-1">
        <span className="block font-medium">{title}</span>
        {detail && <span className="block text-sm text-dim">{detail}</span>}
      </span>
      <span className="text-xs text-dim">{Math.min(streak + (optimistic && !done ? 1 : 0), target)}/{target}</span>
    </button>
  );
}
