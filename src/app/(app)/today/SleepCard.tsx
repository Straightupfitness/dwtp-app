"use client";
import { useOptimistic, useState, useTransition } from "react";
import { sleepOn } from "../log/actions";

const display = "font-[family-name:var(--font-display)] uppercase";
const fmt = (h: number) => `${Math.floor(h)}${h % 1 ? `:${String(Math.round((h % 1) * 60)).padStart(2, "0")}` : ""} h`;

/**
 * November 19 (Sara: "Is there a place to track sleep?"): last night's sleep, one tap. Saved on today's date (the day
 * she woke up), and sleep habits she reached ("Sleep 7+ hours") check themselves off.
 */
export default function SleepCard({ date, minutes, preview = false }: { date: string; minutes: number | null; preview?: boolean }) {
  const [shown, set] = useOptimistic<number | null, number | null>(minutes != null ? minutes / 60 : null, (_, h) => h);
  const [, start] = useTransition();
  const [other, setOther] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  // November 21: an Android client said sleep wasn't saving. Now a failed save always says so (and tries once more),
  // and a good one says "Saved", so she's never left guessing.
  const save = (h: number | null) => {
    if (preview) return;
    setErr(""); setOk(false);
    start(async () => {
      set(h);
      let r: { error?: string; ok?: boolean } | undefined;
      try { r = await sleepOn(date, h); }
      catch { try { r = await sleepOn(date, h); } catch { r = { error: "It didn't save. Close the app, open it again and try once more." }; } }
      if (r?.error) setErr(r.error); else setOk(true);
    });
  };
  return (
    <div id="sleep" className="space-y-2.5 rounded-2xl border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className={`${display} flex items-center gap-1.5 text-[15px] font-medium leading-tight text-[#cfcfcf]`}>
          <span className="shrink-0 text-[#818cf8]"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" /></svg></span>
          How many hours of sleep did you get last night?
        </p>
        {shown != null && <button type="button" onClick={() => save(null)} className="min-h-8 text-[12px] text-dim underline">Clear</button>}
      </div>
      {shown != null ? (
        <p className="text-[15px]"><b className={`${display} text-[26px] tabular-nums`}>{fmt(shown)}</b> <span className="text-dim">logged{shown >= 7 ? " · nice" : ""}</span></p>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {[5, 6, 6.5, 7, 7.5, 8, 9].map((h) => (
          <button key={h} type="button" onClick={() => save(h)} aria-pressed={shown === h}
            className={`min-h-10 min-w-[3.25rem] flex-1 rounded-lg border text-[14px] font-semibold ${shown === h ? "border-[#818cf8] bg-[#818cf8] text-black" : "border-[#2e2f55] bg-[#13142a] text-[#c7c9ff]"}`}>{h}</button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); const n = Number(other.replace(",", ".").replace(/[^\d.]/g, "")); if (n) { save(n); setOther(""); } else setErr("Type your hours as a number, like 6.5."); }} className="flex gap-2">
        <input value={other} onChange={(e) => setOther(e.target.value)} inputMode="decimal" placeholder="Other, like 5.5" aria-label="Hours of sleep"
          className="min-h-10 min-w-0 flex-1 rounded-lg border border-[#2a2a2a] bg-bg px-3 text-[15px] outline-none focus:border-[#818cf8]" />
        <button className="min-h-10 shrink-0 rounded-lg border border-[#2e2f55] px-3 text-[13px] font-semibold text-[#c7c9ff]">Save</button>
      </form>
      {err && <p className="text-xs text-[var(--red)]">{err}</p>}
      {ok && !err && <p className="text-xs text-[#7ddc8f]">✓ Saved</p>}
    </div>
  );
}
