"use client";
import { useState } from "react";
import { getHealthCode } from "@/app/(app)/me/actions";

/** Apple Health through an iPhone Shortcut: install it, paste her code once, and her steps, sleep and weight arrive every evening. */
export default function HealthSync({ shortcutUrl, lastSync, lastDay }: {
  shortcutUrl: string | null; lastSync: string | null; lastDay: { steps: number | null; sleep_minutes: number | null } | null;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function show() {
    setBusy(true); setMsg("");
    const r = await getHealthCode().catch(() => ({ error: "Couldn't make a code. Try again." }));
    setBusy(false);
    if ("code" in r && r.code) setCode(r.code); else setMsg((r as { error?: string }).error ?? "Couldn't make a code.");
  }
  async function copy() {
    try { await navigator.clipboard.writeText(code.replace("-", "")); setMsg("Copied. Paste it into the Shortcut."); } catch { setMsg("Press and hold the code to copy it."); }
  }
  const when = lastSync ? new Date(lastSync).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }) : null;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3.5">
      <div>
        <p className="font-medium">Sync Apple Health</p>
        <p className="text-xs text-dim">Your steps, sleep and weight come in by themselves every evening, and the matching habits check themselves off. iPhone only.</p>
      </div>
      {when ? (
        <p className="rounded-lg bg-[#0f1a14] px-3 py-2 text-[13px] text-[#7ee2a8]">Connected · last sync {when}
          {lastDay && <span className="text-[#a8a8a8]">{lastDay.steps !== null ? ` · ${lastDay.steps.toLocaleString()} steps` : ""}{lastDay.sleep_minutes !== null ? ` · ${(lastDay.sleep_minutes / 60).toFixed(1)} h sleep` : ""}</span>}</p>
      ) : null}
      <ol className="space-y-2 text-[14px]">
        <li className="flex gap-2"><b className="text-accent">1.</b><span>Tap <b>Show my sync code</b> and copy it.</span></li>
        <li className="flex gap-2"><b className="text-accent">2.</b><span>Tap <b>Install the Shortcut</b>, then <b>Add Shortcut</b>. Paste your code when it asks.</span></li>
        <li className="flex gap-2"><b className="text-accent">3.</b><span>Run it once and tap <b>Allow</b> for Health. It then runs by itself every evening.</span></li>
      </ol>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={show} disabled={busy} className="min-h-11 rounded-lg border border-accent px-4 text-[14px] font-semibold text-accent disabled:opacity-50">
          {busy ? "…" : code ? "Get a new code" : "Show my sync code"}
        </button>
        {shortcutUrl
          ? <a href={shortcutUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-[14px] font-semibold text-black">Install the Shortcut</a>
          : <span className="self-center text-xs text-dim">The Shortcut link is coming soon.</span>}
      </div>
      {code && (
        <button type="button" onClick={copy} className="flex w-full items-center justify-between rounded-lg border border-[#2a2a2a] bg-bg px-3 py-2.5">
          <span className="font-mono text-[20px] tracking-[0.15em]">{code}</span><span className="text-xs text-accent">Copy</span>
        </button>
      )}
      {code && <p className="text-xs text-dim">Getting a new code turns off the old one. If you set the Shortcut up before, add it again with this code.</p>}
      {msg && <p className="text-xs text-dim">{msg}</p>}
    </div>
  );
}
