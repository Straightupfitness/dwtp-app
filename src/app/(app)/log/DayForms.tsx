"use client";
import { useOptimistic, useState, useTransition } from "react";
import { habitOn, waterOn, weightOn } from "./actions";

const input = "min-h-11 min-w-0 flex-1 rounded-lg border border-[#2a2a2a] bg-bg px-3 text-lg outline-none focus:border-accent";
const btn = "min-h-11 shrink-0 rounded-lg bg-accent px-4 text-sm font-semibold text-black disabled:opacity-40";

export function WeightDay({ date, value }: { date: string; value: number | null }) {
  const [v, setV] = useState(value === null ? "" : String(value));
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <form onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await weightOn(date, v.trim() ? Number(v) : null); setMsg(r?.error ?? "Saved."); }); }} className="space-y-1.5">
      <div className="flex gap-2">
        <input value={v} onChange={(e) => setV(e.target.value)} type="number" step="0.1" inputMode="decimal" placeholder="lbs" aria-label="Weight in lbs" className={input} />
        <button disabled={pending} className={btn}>{pending ? "…" : "Save"}</button>
      </div>
      {msg && <p className="text-xs text-dim">{msg}</p>}
    </form>
  );
}

export function WaterDay({ date, value, goal }: { date: string; value: number; goal: number }) {
  const [v, setV] = useState(String(value || ""));
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <form onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await waterOn(date, Number(v) || 0); setMsg(r?.error ?? "Saved."); }); }} className="space-y-1.5">
      <div className="flex gap-2">
        <input value={v} onChange={(e) => setV(e.target.value)} type="number" inputMode="numeric" placeholder={`oz (goal ${goal})`} aria-label="Water in ounces that day" className={input} />
        <button type="button" onClick={() => setV(String(goal))} className="min-h-11 shrink-0 rounded-lg border border-[#244456] px-3 text-sm text-[#9bdcff]">Hit {goal}</button>
        <button disabled={pending} className={btn}>{pending ? "…" : "Save"}</button>
      </div>
      {msg && <p className="text-xs text-dim">{msg}</p>}
    </form>
  );
}

export function HabitDay({ id, date, title, done, color, auto }: { id: string; date: string; title: string; done: boolean; color: string; auto: string | null }) {
  const [on, setOn] = useOptimistic(done);
  const [, start] = useTransition();
  return (
    <button type="button" disabled={!!auto} onClick={() => start(async () => { setOn(!on); await habitOn(id, date, !on); })} aria-pressed={on}
      className="flex min-h-11 w-full items-start gap-3 py-2 text-left disabled:opacity-60">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border-2" style={on ? { background: color, borderColor: color } : { borderColor: "#3a3a3a" }}>
        {on && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>}
      </span>
      <span className="flex-1"><span className="block text-[15px]">{title}</span>{auto && <span className="block text-xs text-dim">{auto}</span>}</span>
    </button>
  );
}
