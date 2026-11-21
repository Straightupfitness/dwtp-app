"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Mode, Period } from "@/lib/cycle";
import { addPastPeriod, deletePeriod, setCycleMode } from "./actions";

const nice = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const OPTIONS: [Mode, string, string][] = [
  ["period", "Track my period", "Log when it starts and ends. The app learns your cycle and suggests how hard to lift."],
  ["symptoms", "No period (perimenopause or menopause)", "Just a quick daily energy and symptoms check to guide your lifting."],
  [null, "Off", "No cycle tracking."],
];

/** November 17: turn the cycle tracker on or off, and log or fix past periods. */
export default function CycleSettings({ mode, periods, today }: { mode: Mode; periods: Period[]; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [s, setS] = useState(""), [e, setE] = useState(""), [msg, setMsg] = useState("");
  const run = (f: () => Promise<{ error?: string } | { ok: true }>) => start(async () => { const r = await f(); setMsg("error" in r && r.error ? r.error : "Saved ✓"); router.refresh(); });
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        {OPTIONS.map(([v, label, sub]) => (
          <button key={String(v)} type="button" disabled={pending} onClick={() => run(() => setCycleMode(v))} aria-pressed={mode === v}
            className={`block w-full rounded-2xl border p-3.5 text-left ${mode === v ? "border-accent bg-accent/10" : "border-border bg-card"}`}>
            <span className="flex items-center justify-between text-[15px] font-semibold">{label}{mode === v && <span className="text-accent">✓</span>}</span>
            <span className="mt-0.5 block text-[13px] text-dim">{sub}</span>
          </button>
        ))}
      </div>

      {mode === "period" && (
        <>
          <div id="past-period" className="scroll-mt-20 space-y-2 rounded-2xl border border-border bg-card p-3.5">
            <p className="text-[14px] font-semibold">Log a past period</p>
            <p className="text-[12px] text-dim">Pick the day it started, and the day it ended if it&apos;s over. Your last 2 or 3 help the app learn your cycle length right away. Logging the same start day again updates it.</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-[12px] text-dim">Started<input type="date" max={today} value={s} onChange={(x) => setS(x.target.value)} className="min-h-11 rounded-xl border border-border bg-bg px-2 text-[15px] text-text [color-scheme:dark]" /></label>
              <label className="flex flex-col gap-1 text-[12px] text-dim">Ended (optional)<input type="date" max={today} value={e} onChange={(x) => setE(x.target.value)} className="min-h-11 rounded-xl border border-border bg-bg px-2 text-[15px] text-text [color-scheme:dark]" /></label>
            </div>
            <button type="button" disabled={pending || !s} onClick={() => run(async () => { const r = await addPastPeriod(s, e || null); if (!("error" in r && r.error)) { setS(""); setE(""); } return r; })}
              className="min-h-11 w-full rounded-xl bg-accent text-[14px] font-semibold text-black disabled:opacity-40">{pending ? "Saving…" : "Save this period"}</button>
            {msg && <p className={`text-[13px] ${msg.startsWith("Saved") ? "text-[#7ddc8f]" : "text-[var(--red)]"}`}>{msg}</p>}
          </div>
          <div className="space-y-1.5">
            <p className="text-[12px] uppercase tracking-[0.14em] text-dim">Your periods</p>
            {periods.length ? (
              <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
                {periods.map((p) => (
                  <li key={p.start_date} className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-[14px]">
                    <span>{nice(p.start_date)}{p.end_date ? ` – ${nice(p.end_date)}` : ""}</span>
                    <button type="button" disabled={pending} onClick={() => run(() => deletePeriod(p.start_date))} className="min-h-9 px-2 text-[13px] text-dim underline">Delete</button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-[13px] text-dim">None yet.</p>}
          </div>
        </>
      )}
      {msg && mode !== "period" && <p className="text-[13px] text-dim">{msg}</p>}
      <p className="text-[12px] leading-relaxed text-dim">Only you and Michael can see this. It&apos;s a guide for training, not a way to predict or prevent pregnancy.</p>
    </div>
  );
}
