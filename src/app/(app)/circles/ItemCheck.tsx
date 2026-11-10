"use client";
import { useOptimistic, useTransition } from "react";
import { toggleHabit } from "../habits/actions";
import { celebrate, markSeen } from "@/lib/celebrate";
import type { HowTo } from "@/lib/circles";

/** One habit's check-off button: today (daily), this week (weekly) or once (Get / Learn). */
export default function ItemCheck({ itemId, done, complete, title, detail, eyebrow, progress, target, cadence, color, alsoIn, auto, howTo }: {
  itemId: string; done: boolean; complete: boolean; title: string; detail?: string | null; eyebrow?: string;
  progress: number; target: number; cadence: string; color: string; alsoIn?: string[]; auto?: string | null; howTo?: HowTo | null;
}) {
  const [on, setOn] = useOptimistic(done);
  const [, start] = useTransition();
  const shown = Math.min(target, progress + (on && !done ? 1 : !on && done ? -1 : 0));
  const unit = cadence === "weekly" ? "wk" : cadence === "daily" ? "days" : "";
  const Tag = auto ? "div" : "button";
  const check = (
    <Tag {...(auto ? {} : { onClick: (e: React.MouseEvent<HTMLElement>) => {
        // Checking a habit off earns 1 CP: ka-ching right away.
        if (!on) { celebrate("habit-done", e.currentTarget.querySelector("span")); markSeen(1); }
        start(async () => { setOn(!on); await toggleHabit(itemId, !on); });
      }, "aria-pressed": on })}
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
  if (!howTo) return check;
  return (
    <div>
      {check}
      <HowToCard howTo={howTo} color={color} />
    </div>
  );
}

/** "**bold**" → <b>bold</b>, "*soft*" → <i>soft</i>. Just enough for the cards. */
function rich(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) =>
    part.startsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : part.startsWith("*") && part.length > 2 ? <i key={i}>{part.slice(1, -1)}</i> : part);
}

/** November 10: "How to do it" under a habit that's a whole technique. Closed until she taps it. */
function HowToCard({ howTo, color }: { howTo: HowTo; color: string }) {
  return (
    <details className="group mb-2 ml-10 rounded-xl border border-border bg-bg/60">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 px-3 text-[13px] font-semibold" style={{ color }}>
        How to do it
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" className="transition group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
      </summary>
      <div className="space-y-2 px-3 pb-3">
        <p className="text-[13px] text-[#a8a8a8]"><b className="text-text">Why: </b>{rich(howTo.why)}</p>
        <ol className="space-y-1.5">
          {howTo.steps.map((step, i) => (
            <li key={i} className="flex gap-2 text-[14px] leading-snug">
              <span className="grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-black" style={{ background: color }}>{i + 1}</span>
              <span className="whitespace-pre-line">{rich(step)}</span>
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}
