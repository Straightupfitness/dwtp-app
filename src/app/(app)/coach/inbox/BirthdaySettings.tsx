"use client";
import { useState, useTransition } from "react";
import { saveBirthdaySettings } from "./birthday-actions";

type Upcoming = { id: string; name: string; when: string; days: number };

/** Automatic birthday messages (November 2): on/off, the words, and whose birthday is coming up. */
export default function BirthdaySettings({ on, message, upcoming, missing }: { on: boolean; message: string; upcoming: Upcoming[]; missing: number }) {
  const [enabled, setEnabled] = useState(on);
  const [text, setText] = useState(message);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const save = (o: boolean, t: string) => start(async () => { const r = await saveBirthdaySettings(o, t); setMsg(r?.error ?? "Saved."); });
  return (
    <details className="group rounded-xl border border-border bg-card p-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm">
        <span>🎂 <b>Birthday messages</b> <span className="text-dim">· {enabled ? "on" : "off"}{upcoming[0] ? ` · next: ${upcoming[0].name.split(" ")[0]} ${upcoming[0].days === 0 ? "today" : `in ${upcoming[0].days}d`}` : ""}</span></span>
        <span className="text-dim transition group-open:rotate-180">⌄</span>
      </summary>
      <div className="mt-3 space-y-3 text-sm">
        <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5">
          <span>Send automatically in chat on her birthday morning</span>
          <input type="checkbox" checked={enabled} onChange={(e) => { setEnabled(e.target.checked); save(e.target.checked, text); }} className="size-5 accent-[var(--accent)]" />
        </label>
        <div className="space-y-1.5">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} aria-label="Birthday message"
            className="w-full rounded-lg border border-border bg-bg p-2.5 text-base outline-none focus:border-accent" />
          <div className="flex items-center gap-2">
            <button type="button" disabled={pending} onClick={() => save(enabled, text)} className="min-h-10 rounded-lg bg-accent px-4 font-semibold text-black disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
            <span className="text-[12px] text-dim">{"{first}"} becomes her first name.</span>
          </div>
          {msg && <p className="text-[12px] text-dim">{msg}</p>}
        </div>
        <div>
          <p className="text-[12px] uppercase tracking-[0.1em] text-dim">Next 60 days</p>
          {upcoming.length
            ? <ul className="mt-1 divide-y divide-border">{upcoming.map((u) => <li key={u.id} className="flex justify-between py-1.5"><span>{u.name}</span><span className="text-dim">{u.when}{u.days === 0 ? " · today" : ` · in ${u.days}d`}</span></li>)}</ul>
            : <p className="mt-1 text-dim">No birthdays coming up.</p>}
          {missing > 0 && <p className="mt-2 text-[12px] text-dim">{missing} client{missing === 1 ? " has" : "s have"} no birthday yet. Add it under Edit details on her page, or she can add it under Account.</p>}
        </div>
      </div>
    </details>
  );
}
