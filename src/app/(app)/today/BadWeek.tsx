"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { BAD_WEEK_LIMIT, BAD_WEEK_THREE } from "@/lib/bad-weeks";
import { startBadWeek, undoBadWeek } from "./actions";

const display = "font-[family-name:var(--font-display)] uppercase";

/** This week is a bad week: just the three things (November 6). */
export function BadWeekActive({ left }: { left: number }) {
  const [pending, start] = useTransition();
  const [ask, setAsk] = useState(false);
  return (
    <section className="space-y-3 rounded-2xl border border-[#7c5cff]/60 bg-[#151024] p-4">
      <p className="text-[11px] uppercase tracking-[0.15em] text-[#b9a6ff]">Bad Week Plan · this week</p>
      <h2 className={`${display} text-[22px] leading-tight`}>Just these three things</h2>
      <ol className="space-y-2">
        {BAD_WEEK_THREE.map((t, i) => (
          <li key={t.title} className="flex gap-3 rounded-xl bg-black/30 p-2.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#7c5cff] text-[14px] font-bold text-white">{i + 1}</span>
            <span><span className="block text-[15px] font-semibold leading-snug">{t.title}</span><span className="block text-[12px] text-[#a8a8a8]">{t.detail}</span></span>
          </li>
        ))}
      </ol>
      <p className="text-[13px] leading-snug text-[#cfcfcf]">Everything else is paused this week: workouts, food logging, lessons. No guilt, no catching up. Michael will pick it back up with you next week.</p>
      <p className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-dim">
        <span>{left} bad week{left === 1 ? "" : "s"} left after this one</span>
        {ask
          ? <button type="button" disabled={pending} onClick={() => start(async () => { await undoBadWeek(); })} className="min-h-9 text-[#b9a6ff] underline">{pending ? "…" : "Yes, make this a normal week"}</button>
          : <button type="button" onClick={() => setAsk(true)} className="min-h-9 underline">Not a bad week after all?</button>}
      </p>
    </section>
  );
}

/** "Having a bad week?" (at the bottom of Today). */
export function BadWeekOffer({ left }: { left: number }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <section className="rounded-2xl border border-border bg-card p-3.5">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 text-left">
        <span><span className="block text-[15px] font-semibold">Having a bad week?</span><span className="block text-[12px] text-[#a8a8a8]">Ease off without falling off</span></span>
        <span className="text-dim">{open ? "⌃" : "⌄"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2.5 text-[14px] leading-snug text-[#cfcfcf]">
          <p>Work deadline, sick kid, travel, the flu. When life wins a week, switch to the Bad Week Plan and do just three things:</p>
          <ol className="list-decimal space-y-1 pl-5">{BAD_WEEK_THREE.map((t) => <li key={t.title}>{t.title}</li>)}</ol>
          <p>Everything else pauses, and the week still counts. You get {BAD_WEEK_LIMIT} across the 26 weeks{left < BAD_WEEK_LIMIT ? ` (${left} left)` : ""}.</p>
          {left > 0
            ? <button type="button" disabled={pending} onClick={() => start(async () => { const r = await startBadWeek(); if (r?.error) setMsg(r.error); })}
                className="grid min-h-12 w-full place-items-center rounded-xl bg-[#7c5cff] font-semibold text-white disabled:opacity-60">{pending ? "Switching…" : "Start my Bad Week Plan"}</button>
            : <p className="rounded-xl border border-border p-3">You&apos;ve used all {BAD_WEEK_LIMIT} bad weeks. <Link href="/chat" className="text-accent underline">Message Michael</Link> and he&apos;ll help you through this one.</p>}
          {msg && <p className="text-[13px] text-[#fb7185]">{msg}</p>}
        </div>
      )}
    </section>
  );
}
