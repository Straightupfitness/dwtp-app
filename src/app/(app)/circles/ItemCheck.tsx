"use client";
import { useOptimistic, useTransition } from "react";
import { toggleHabit } from "../habits/actions";

/** One habit's check-off button: today (daily), this week (weekly) or once (Get / Learn). */
export default function ItemCheck({ itemId, done, complete, title, detail, eyebrow, progress, target, cadence, color, alsoIn, auto }: {
  itemId: string; done: boolean; complete: boolean; title: string; detail?: string | null; eyebrow?: string;
  progress: number; target: number; cadence: string; color: string; alsoIn?: string[]; auto?: string | null;
}) {
  const [on, setOn] = useOptimistic(done);
  const [, start] = useTransition();
  const shown = Math.min(target, progress + (on && !done ? 1 : !on && done ? -1 : 0));
  const unit = cadence === "weekly" ? "wk" : cadence === "daily" ? "days" : "";
  const Tag = auto ? "div" : "button";
  return (
    <Tag {...(auto ? {} : { onClick: () => start(async () => { setOn(!on); await toggleHabit(itemId, !on); }), "aria-pressed": on })}
      className="flex min-h-11 w-full items-start gap-3 py-2 text-left">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border-2"
        style={on ? { background: color, borderColor: color } : { borderColor: "#3a3a3a" }}>
        {on && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>}
      </span>
      <span className="flex-1">
        {eyebrow && <span className="block text-[11px] uppercase tracking-[0.1em]" style={{ color }}>{eyebrow}</span>}
        <span className="block text-[15px]">{title}</span>
        {detail && <span className="block text-sm text-dim">{detail}</span>}
        {cadence === "weekly" && <span className="block text-xs text-dim">Once this week</span>}
        {auto && <span className="block text-xs text-dim">{auto}</span>}
        {!!alsoIn?.length && <span className="block text-xs text-dim">Also counts in {alsoIn.join(", ")}</span>}
      </span>
      <span className="shrink-0 text-xs" style={{ color: complete ? color : "#8a8a8a" }}>
        {complete ? "Done" : unit ? `${Math.max(0, shown)}/${target} ${unit}` : ""}
      </span>
    </Tag>
  );
}
