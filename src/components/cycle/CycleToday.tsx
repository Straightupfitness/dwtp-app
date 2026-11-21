"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { INTENSITY_INFO, PHASE_INFO, SYMPTOMS, suggest, type Cycle, type DayLog, type Mode } from "@/lib/cycle";
import { periodEnded, periodStarted, saveDayLog } from "@/app/(app)/cycle/actions";

/**
 * November 17 (Michael): her cycle on Today. Where she is (period, follicular, ovulation, luteal), a one-tap
 * "period started / ended", a quick energy + symptoms check, and what that means for lifting today.
 */
export default function CycleToday({ mode, cycle, log, hasPeriods, preview = false }: { mode: Exclude<Mode, null>; cycle: Cycle | null; log: DayLog | null; hasPeriods: boolean; preview?: boolean }) {
  const [energy, setEnergy] = useState<number | null>(log?.energy ?? null);
  const [symptoms, setSymptoms] = useState<string[]>(log?.symptoms ?? []);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const save = (patch: Parameters<typeof saveDayLog>[0]) => { if (preview) return; start(async () => { const r = await saveDayLog(patch); if (r?.error) setMsg(r.error); }); };
  const s = suggest(mode, cycle, { energy, symptoms, intensity: null });
  const info = cycle ? PHASE_INFO[cycle.phase] : null;
  const chip = "min-h-9 rounded-full border px-3 text-[13px]";
  const list = mode === "symptoms" ? SYMPTOMS.filter(([k]) => k !== "cramps") : SYMPTOMS;

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.15em] text-accent">{mode === "period" ? "Your cycle" : "How you feel today"}</p>
          {info && cycle ? (
            <p className="mt-1 text-[15px]"><span className="rounded-full px-2 py-0.5 text-[12px] font-bold text-black" style={{ background: info.color }}>{info.label}</span>
              <span className="ml-2 text-dim">Day {cycle.day}{cycle.phase !== "late" ? ` · period in about ${cycle.nextIn} day${cycle.nextIn === 1 ? "" : "s"}` : ""}</span></p>
          ) : mode === "period" ? <p className="mt-1 text-[14px] text-dim">Log your last period to see where you are.</p> : null}
        </div>
        <Link href="/cycle" className="shrink-0 text-[12px] text-dim underline">Settings</Link>
      </div>
      {info && <p className="text-[13px] leading-snug text-[#cfcfcf]">{info.note}{cycle && !cycle.learned ? " (Using a 28-day cycle until you've logged a few periods.)" : ""}</p>}

      {mode === "period" && (
        <div className="flex flex-wrap gap-2">
          {!hasPeriods ? <Link href="/cycle" className="inline-flex min-h-10 items-center rounded-xl border border-accent px-3 text-[13px] font-semibold text-accent">Log my last period</Link>
            : cycle?.phase === "period"
              ? <button type="button" disabled={pending || preview} onClick={() => start(async () => { const r = await periodEnded(); setMsg(r?.error ?? "Saved ✓"); })} className="min-h-10 rounded-xl border border-border px-3 text-[13px] font-semibold">My period ended today</button>
              : null}
          {cycle?.phase !== "period" && (
            <button type="button" disabled={pending || preview} onClick={() => start(async () => { const r = await periodStarted(); setMsg(r?.error ?? "Saved ✓"); })} className="min-h-10 rounded-xl border border-[#ef4444]/60 px-3 text-[13px] font-semibold text-[#ff8a8a]">🩸 My period started today</button>
          )}
          {/* November 21: a client couldn't find where to log an earlier period. */}
          {hasPeriods && <Link href="/cycle#past-period" className="inline-flex min-h-10 items-center rounded-xl border border-border px-3 text-[13px] font-semibold text-[#cfcfcf]">📅 Log a past period</Link>}
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-[12px] text-dim">Energy today</p>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" aria-pressed={energy === n} onClick={() => { const v = energy === n ? null : n; setEnergy(v); save({ energy: v }); }}
              className={`min-h-10 flex-1 rounded-xl border text-[15px] font-semibold ${energy === n ? "border-accent bg-accent text-black" : "border-border text-dim"}`}>{n}</button>
          ))}
        </div>
        <div className="flex justify-between text-[11px] text-dim"><span>Drained</span><span>Great</span></div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {list.map(([k, label]) => {
          const on = symptoms.includes(k);
          return <button key={k} type="button" aria-pressed={on} onClick={() => { const v = on ? symptoms.filter((x) => x !== k) : [...symptoms, k]; setSymptoms(v); save({ symptoms: v }); }}
            className={`${chip} ${on ? "border-accent text-accent" : "border-border text-dim"}`}>{label}</button>;
        })}
      </div>
      <p className="rounded-xl bg-[#161310] p-2.5 text-[13px] text-[#e9dcc0]">
        <b>Lifting today: {INTENSITY_INFO[s.pick].icon} {INTENSITY_INFO[s.pick].label}.</b> {s.why} You choose when you start your workout.
      </p>
      {msg && <p className="text-[12px] text-dim">{msg}</p>}
    </div>
  );
}
