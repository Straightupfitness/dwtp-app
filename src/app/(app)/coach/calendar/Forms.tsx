"use client";
import { useState, useTransition } from "react";
import { saveCall, saveLinks } from "./actions";

const input = "min-h-11 w-full rounded-lg border border-[#2a2a2a] bg-bg px-3 text-[15px] outline-none focus:border-accent";

export function LinksForm({ zoom, trainerize, shortcut }: { zoom: string; trainerize: string; shortcut: string }) {
  const [msg, setMsg] = useState(""); const [pending, start] = useTransition();
  return (
    <form action={(f) => start(async () => { await saveLinks(f); setMsg("Saved."); })} className="space-y-2.5 rounded-2xl border border-border bg-card p-3.5">
      <label className="block space-y-1"><span className="text-[13px] text-[#a8a8a8]">Real Talk Tuesday Zoom link (the same every week)</span>
        <input name="rtt_zoom_url" defaultValue={zoom} placeholder="https://us02web.zoom.us/j/…" className={input} /></label>
      <label className="block space-y-1"><span className="text-[13px] text-[#a8a8a8]">Trainerize link (opens from her workout days)</span>
        <input name="trainerize_url" defaultValue={trainerize} placeholder="https://…trainerize.com" className={input} /></label>
      <label className="block space-y-1"><span className="text-[13px] text-[#a8a8a8]">Apple Health Shortcut link (iCloud link from Shortcuts → Share → Copy iCloud Link)</span>
        <input name="health_shortcut_url" defaultValue={shortcut} placeholder="https://www.icloud.com/shortcuts/…" className={input} /></label>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="min-h-11 rounded-lg bg-accent px-5 text-[15px] font-semibold text-black disabled:opacity-50">{pending ? "Saving…" : "Save links"}</button>
        {msg && <span className="text-sm text-dim">{msg}</span>}
      </div>
    </form>
  );
}

export function CallRow({ date, label, title, replay, cancelled, past }: { date: string; label: string; title: string; replay: string; cancelled: boolean; past: boolean }) {
  const [msg, setMsg] = useState(""); const [pending, start] = useTransition();
  return (
    <form action={(f) => start(async () => { const r = await saveCall(f); setMsg(r?.error ?? "Saved."); })} className="space-y-2 rounded-xl border border-border bg-card p-3">
      <input type="hidden" name="call_date" value={date} />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[14px] font-semibold">{label}{past && !replay && !cancelled && <span className="ml-2 text-xs font-normal text-[#ff8a7e]">No replay yet</span>}</p>
        <label className="flex items-center gap-1.5 text-xs text-dim"><input type="checkbox" name="cancelled" defaultChecked={cancelled} className="accent-[var(--accent)]" />No call</label>
      </div>
      <input name="title" defaultValue={title} placeholder="Topic (optional), e.g. Sleep Q&A" aria-label="Topic" className={input} />
      <div className="flex gap-2">
        <input name="replay_url" defaultValue={replay} placeholder="Replay link (YouTube, Zoom or Loom)" aria-label="Replay link" className={input} />
        <button disabled={pending} className="min-h-11 shrink-0 rounded-lg border border-accent px-4 text-[14px] font-semibold text-accent disabled:opacity-50">{pending ? "…" : "Save"}</button>
      </div>
      {msg && <p className="text-xs text-dim">{msg}</p>}
    </form>
  );
}
