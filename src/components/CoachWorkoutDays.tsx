"use client";
import { useState, useTransition } from "react";
import { setClientWorkoutDays } from "@/app/(app)/coach/clients/[id]/actions";

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first, like the program week
const NAME = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * November 15: Michael picks her workout days and sees exactly which workout lands on which day (Day 1 on her first
 * workout day of the week, Day 2 on the next…). Works before her start date too.
 */
export default function CoachWorkoutDays({ clientId, first, initial, workouts, weekLabel, programName }: {
  clientId: string; first: string; initial: number[]; workouts: { day: number | null; title: string }[]; weekLabel: string; programName: string;
}) {
  const [days, setDays] = useState<number[]>(initial);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const dirty = [...days].sort().join() !== [...initial].sort().join();
  const picked = ORDER.filter((d) => days.includes(d));
  const need = workouts.length;
  return (
    <div className="space-y-2.5 rounded-xl border border-border bg-card p-3 text-sm">
      <div>
        <p className="font-semibold">{first}&apos;s workout days</p>
        <p className="text-[12px] text-dim">{programName} · {need} workout{need === 1 ? "" : "s"} a week. They go in order onto the days you pick.</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ORDER.map((d) => {
          const on = days.includes(d);
          return <button key={d} type="button" aria-pressed={on} onClick={() => { setDays((x) => on ? x.filter((y) => y !== d) : [...x, d]); setMsg(""); }}
            className={`min-h-10 min-w-[3.1rem] rounded-lg border text-[13px] font-semibold ${on ? "border-accent bg-accent text-black" : "border-[#2a2a2a] text-dim"}`}>{NAME[d].slice(0, 3)}</button>;
        })}
      </div>
      <div className="rounded-lg border border-[#242424] bg-bg/60 p-2.5">
        <p className="mb-1 text-[11px] uppercase tracking-[0.1em] text-dim">{weekLabel}: what lands where</p>
        {picked.length >= need ? (
          <ul className="space-y-0.5 text-[13px]">
            {picked.map((d, i) => <li key={d}><b className="inline-block w-24">{NAME[d]}</b>{workouts[i] ? workouts[i].title : <span className="text-dim">Cardio or catch-up</span>}</li>)}
          </ul>
        ) : <p className="text-[13px] text-[#e7d3a8]">Pick at least {need} days. With fewer, her calendar uses the default days for {need} workouts.</p>}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" disabled={!dirty || pending || picked.length < need} onClick={() => start(async () => {
          const r = await setClientWorkoutDays(clientId, days);
          setMsg(r?.error ?? "Saved ✓ Her calendar shows these days now.");
        })} className="min-h-10 rounded-lg bg-accent px-4 text-[13px] font-semibold text-black disabled:opacity-40">{pending ? "Saving…" : "Save her days"}</button>
        {msg && <span className="text-[12px] text-dim">{msg}</span>}
      </div>
      <p className="text-[11px] text-dim">She can still change her days in her Calendar. A workout she does on another day moves to the day she did it, and one she misses rolls forward.</p>
    </div>
  );
}
