"use client";
import { useState } from "react";

/** Thursday morning voice note: an AI script in Michael's voice, 30–60 seconds, to read into his phone. */
export default function ThursdayScript({ clientId }: { clientId: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const words = text.trim().split(/\s+/).filter(Boolean).length;

  async function make() {
    setBusy(true); setMsg("");
    const res = await fetch("/api/coach/thursday", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId }) });
    const data = await res.json().catch(() => ({ error: "The AI script failed." }));
    setBusy(false);
    if (!res.ok) setMsg(data.error); else setText(data.script);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(text); setMsg("Copied."); } catch { setMsg("Select the text and copy it."); }
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Thursday voice note</p>
        <button type="button" onClick={make} disabled={busy} className="min-h-10 rounded-lg border border-accent px-3 text-[13px] font-semibold text-accent disabled:opacity-50">
          {busy ? "Writing… (about 15 sec)" : text ? "Write a new one" : "Write the script"}
        </button>
      </div>
      {text && <>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7}
          className="w-full rounded-lg border border-border bg-bg p-3 text-[15px] leading-relaxed outline-none focus:border-accent" />
        <div className="flex items-center justify-between text-xs text-dim">
          <span>{words} words · about {Math.round((words / 150) * 60)} sec spoken</span>
          <button type="button" onClick={copy} className="min-h-9 px-2 font-semibold text-accent">Copy</button>
        </div>
      </>}
      {!text && !msg && <p className="text-xs text-dim">What&apos;s waiting in next week&apos;s Habits &amp; Homework, plus what&apos;s going on with her, in 30–60 seconds.</p>}
      {msg && <p className={`text-xs ${msg === "Copied." ? "text-[#7ee2a8]" : "text-[var(--red)]"}`}>{msg}</p>}
    </div>
  );
}
