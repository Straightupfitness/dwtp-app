"use client";
import { useState, useTransition } from "react";
import { setClientSchedule, setClientWorkoutDays } from "@/app/(app)/coach/clients/[id]/actions";

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first, like the program week
const NAME = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export type PlanDay = { day: number; title: string; exercises: string[] };

/** A rough "what it works" label from the exercise names (Michael checks the list). */
export function focusOf(ex: string[]) {
  // Each exercise counts once: lower-body words win ("Leg Press" is legs, "Calf Raise" is legs).
  const LOWER = /squat|deadlift|\brdl\b|lunge|\bleg|hamstring|glute|hip thrust|calf|step[ -]?up|bridge|abduct|adduct|swing|good morning|sled|quad/i;
  const UPPER = /press|row|pull|chin|push|curl|tricep|bicep|\bfly|flye|raise|\blat\b|lats|\bdip|chest|shoulder|delt/i;
  const SKIP = /warm|mobility|stretch|overview|foam|cardio|treadmill|bike|walk|plank|crunch|\babs?\b|core|dead bug|bird dog/i;
  let lower = 0, upper = 0;
  for (const e of ex) { if (SKIP.test(e)) continue; if (LOWER.test(e)) lower++; else if (UPPER.test(e)) upper++; }
  if (!lower && !upper) return "";
  if (lower >= upper * 2) return "Lower body";
  if (upper >= lower * 2) return "Upper body";
  return "Full body";
}

/**
 * November 15 (Claudia: Mon/Tue/Thu, upper/lower/upper from a 4-day program): Michael sees every workout of her
 * program this week (what's in it, what it works) and picks which one goes on which weekday. It follows the program
 * into every phase (Monday stays "Day 2" when the phase changes).
 */
export default function CoachWorkoutDays({ clientId, first, schedule, workoutDays, days, weekLabel, programName }: {
  clientId: string; first: string; schedule: Record<number, number> | null; workoutDays: number[]; days: PlanDay[]; weekLabel: string; programName: string;
}) {
  // Start from his schedule, or from today's rule (Day 1, 2, 3… onto her workout days).
  const initial: Record<number, number> = schedule ?? Object.fromEntries(ORDER.filter((d) => workoutDays.includes(d)).slice(0, days.length).map((wd, i) => [wd, days[i]?.day]).filter((x) => x[1]));
  const [map, setMap] = useState<Record<number, number>>(initial);
  const [open, setOpen] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(map) !== JSON.stringify(initial) || !schedule;
  const used = Object.values(map);
  const dupes = used.filter((d, i) => used.indexOf(d) !== i);
  const title = (d: number) => days.find((x) => x.day === d);

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3 text-sm">
      <div>
        <p className="font-semibold">{first}&apos;s workout week</p>
        <p className="text-[12px] text-dim">{programName} · {weekLabel} · {days.length} workouts in this phase. Pick which one she does on which day. It carries into every phase.</p>
      </div>

      <div className="space-y-1.5">
        {days.map((d) => {
          const f = focusOf(d.exercises);
          return (
            <div key={d.day} className="rounded-lg border border-[#242424] bg-bg/60">
              <button type="button" onClick={() => setOpen(open === d.day ? null : d.day)} className="flex min-h-11 w-full items-center gap-2 px-2.5 text-left">
                <span className="shrink-0 rounded bg-[#2a2a2a] px-1.5 py-0.5 text-[11px] font-bold">Day {d.day}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{d.title}</span>
                {f && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${f === "Lower body" ? "bg-[#1d2a3a] text-[#9cc7ff]" : f === "Upper body" ? "bg-[#33240f] text-accent" : "bg-[#222] text-[#cfcfcf]"}`}>{f}</span>}
                <span className="text-dim">{open === d.day ? "▾" : "▸"}</span>
              </button>
              {open === d.day && (
                <ol className="list-decimal space-y-0.5 px-2.5 pb-2.5 pl-8 text-[13px] text-[#d6d6d6]">{d.exercises.map((e, i) => <li key={i}>{e}</li>)}{!d.exercises.length && <li className="list-none text-dim">No exercises listed.</li>}</ol>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-1.5 rounded-lg border border-[#242424] p-2.5">
        <p className="text-[11px] uppercase tracking-[0.1em] text-dim">Her week</p>
        {ORDER.map((wd) => (
          <label key={wd} className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-[13px] font-semibold">{NAME[wd]}</span>
            <select value={map[wd] ?? ""} onChange={(e) => { const v = Number(e.target.value); setMap((m) => { const n = { ...m }; if (v) n[wd] = v; else delete n[wd]; return n; }); setMsg(""); }}
              className="min-h-10 min-w-0 flex-1 rounded-lg border border-[#2a2a2a] bg-bg px-2 text-[13px] outline-none focus:border-accent">
              <option value="">Rest / cardio</option>
              {days.map((d) => { const f = focusOf(d.exercises); return <option key={d.day} value={d.day}>Day {d.day} · {d.title}{f ? ` (${f})` : ""}</option>; })}
            </select>
          </label>
        ))}
        {dupes.length > 0 && <p className="text-[12px] text-[#e7d3a8]">Day {dupes[0]} is on two days. A workout can only count once a week, so pick a different day for one of them.</p>}
        {Object.keys(map).length > 0 && <p className="text-[12px] text-dim">{ORDER.filter((wd) => map[wd]).map((wd) => `${NAME[wd].slice(0, 3)}: ${title(map[wd])?.title ?? `Day ${map[wd]}`}`).join(" · ")}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={!dirty || pending || dupes.length > 0 || !Object.keys(map).length} onClick={() => start(async () => {
          const r = await setClientSchedule(clientId, map);
          setMsg(r?.error ?? "Saved ✓ Her calendar and Workouts tab follow this week by week.");
        })} className="min-h-10 rounded-lg bg-accent px-4 text-[13px] font-semibold text-black disabled:opacity-40">{pending ? "Saving…" : "Save her week"}</button>
        {schedule && <button type="button" disabled={pending} onClick={() => start(async () => {
          const r = await setClientSchedule(clientId, null);
          if (!r?.error) await setClientWorkoutDays(clientId, workoutDays);
          setMsg(r?.error ?? "Cleared. Workouts go back to Day 1, 2, 3… on her days.");
        })} className="min-h-10 rounded-lg border border-border px-3 text-[13px] text-dim">Clear schedule</button>}
        {msg && <span className="text-[12px] text-dim">{msg}</span>}
      </div>
      <p className="text-[11px] text-dim">If she changes her workout days in her own Calendar, this schedule is cleared and her workouts go back to Day 1, 2, 3… on her days.</p>
    </div>
  );
}
