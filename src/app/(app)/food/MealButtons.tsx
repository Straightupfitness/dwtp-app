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

/** ★ on a logged meal: save it as a favorite (her daily breakfast, a meal "to go") to log again with one tap. */
export function FavoriteMeal({ id, suggest }: { id: string; suggest: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(suggest);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done) return <span className="min-h-9 px-1 text-xs text-[#7ee2a8]">★ Saved</span>;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="min-h-9 px-1 text-xs font-semibold text-accent">★ Favorite</button>;
  return (
    <span className="flex w-full items-center gap-1.5 pt-1">
      <input value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-label="Name this favorite" placeholder="Name it, e.g. Daily breakfast"
        className="min-h-9 min-w-0 flex-1 rounded-lg border border-[#2a2a2a] bg-bg px-2.5 text-[14px] outline-none focus:border-accent" />
      <button type="button" disabled={pending || !name.trim()} onClick={() => start(async () => { const r = await favoriteMeal(id, name); if (!r?.error) setDone(true); })}
        className="min-h-9 rounded-lg bg-accent px-3 text-xs font-semibold text-black disabled:opacity-40">{pending ? "…" : "Save"}</button>
      <button type="button" onClick={() => setOpen(false)} className="min-h-9 px-1 text-xs text-dim">Cancel</button>
    </span>
  );
}
