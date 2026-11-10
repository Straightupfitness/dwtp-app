"use client";
import { useState, useTransition } from "react";
import { copyMeal, favoriteMeal } from "./actions";

/** "Copy to today" on a past meal, or "+ Add" on yesterday's meals shown under today. */
export function CopyMeal({ id, toDay, label = "Copy to today" }: { id: string; toDay: string; label?: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <button type="button" disabled={pending || msg === "Added"} onClick={() => start(async () => { const r = await copyMeal(id, toDay); setMsg(r?.error ?? "Added"); })}
      className="min-h-9 px-1 text-xs font-semibold text-accent disabled:opacity-60">{pending ? "Adding…" : msg || label}</button>
  );
}

const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
const dayName = (d: string, today: string) => d === today ? "Today" : d === addDays(today, -1) ? "Yesterday"
  : new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** November 7: "Copy to…" on any meal: copy it to any day (today, yesterday, the last week, or pick a date), no favorite needed. */
export function CopyMealTo({ id, today, from }: { id: string; today: string; from: string }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(from === today ? addDays(today, -1) : today);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const quick = Array.from({ length: 7 }, (_, i) => addDays(today, -i)).filter((d) => d !== from);
  if (!open) return <button type="button" onClick={() => { setOpen(true); setMsg(""); }} className="min-h-9 px-1 text-xs font-semibold text-accent">Copy to…</button>;
  return (
    <span className="flex w-full flex-wrap items-center gap-1.5 pt-1">
      <select value={quick.includes(to) ? to : "pick"} onChange={(e) => e.target.value !== "pick" && setTo(e.target.value)} aria-label="Copy to which day"
        className="min-h-9 rounded-lg border border-[#2a2a2a] bg-bg px-2 text-[14px] outline-none focus:border-accent">
        {quick.map((d) => <option key={d} value={d}>{dayName(d, today)}</option>)}
        {!quick.includes(to) && <option value="pick">{dayName(to, today)}</option>}
      </select>
      <input type="date" max={today} value={to} onChange={(e) => e.target.value && setTo(e.target.value)} aria-label="Or pick a date"
        className="min-h-9 w-[9.5rem] rounded-lg border border-[#2a2a2a] bg-bg px-2 text-[14px] outline-none [color-scheme:dark] focus:border-accent" />
      <button type="button" disabled={pending || !to || to > today} onClick={() => start(async () => { const r = await copyMeal(id, to); setMsg(r?.error ?? `Copied to ${dayName(to, today)}`); if (!r?.error) setOpen(false); })}
        className="min-h-9 rounded-lg bg-accent px-3 text-xs font-semibold text-black disabled:opacity-40">{pending ? "…" : "Copy"}</button>
      <button type="button" onClick={() => setOpen(false)} className="min-h-9 px-1 text-xs text-dim">Cancel</button>
      {msg && <span className="text-xs text-dim">{msg}</span>}
    </span>
  );
}

/** ★ on a logged meal: save it as a favorite (her daily breakfast, a meal "to go") to log again with one tap. */
export function FavoriteMeal({ id, suggest }: { id: string; suggest: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(suggest);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done) return <span className="min-h-9 px-1 text-xs text-[#7ee2a8]">★ Saved</span>;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="min-h-9 px-1 text-xs font-semibold text-accent">★ Favorite</button>;
  // November 10: say plainly that a favorite needs a name, and what to tap.
  return (
    <span className="block w-full space-y-1.5 rounded-xl border border-accent/60 bg-[#161310] p-2.5">
      <span className="block text-[13px] font-semibold text-accent">★ Name your favorite to save it</span>
      <span className="flex items-center gap-1.5">
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-label="Name this favorite" placeholder="e.g. Daily breakfast"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#2a2a2a] bg-bg px-2.5 text-[15px] outline-none focus:border-accent" />
        <button type="button" disabled={pending || !name.trim()} onClick={() => start(async () => { const r = await favoriteMeal(id, name); if (!r?.error) setDone(true); })}
          className="min-h-11 rounded-lg bg-accent px-3 text-[13px] font-semibold text-black disabled:opacity-40">{pending ? "…" : "Save favorite"}</button>
      </span>
      <span className="flex items-center justify-between text-[11px] text-dim">
        <span>{name.trim() ? "Then tap Save favorite." : "Type a name first. Then tap Save favorite."}</span>
        <button type="button" onClick={() => setOpen(false)} className="min-h-8 px-1 text-xs text-dim underline">Cancel</button>
      </span>
    </span>
  );
}
