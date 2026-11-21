"use client";
import { useState } from "react";
import { captionNext } from "./actions";

/** November 21: make captions for every uploaded video that doesn't have them yet, one at a time. */
export default function CaptionsButton({ missing }: { missing: number }) {
  const [left, setLeft] = useState(missing);
  const [run, setRun] = useState(false);
  const [msg, setMsg] = useState("");
  const [fails, setFails] = useState<string[]>([]);
  async function go() {
    setRun(true); setMsg(""); setFails([]);
    for (let i = 0; i < 400; i++) {
      const r = await captionNext();
      if (r.error && !r.code) { setMsg(r.error); break; }
      if (r.code) { setMsg(`${r.code}: ${r.error ? "skipped" : `${r.lines} lines`}`); if (r.error) setFails((f) => [...f, `${r.code} (${r.error})`]); }
      setLeft(r.left ?? 0);
      if (!r.left) { setMsg("✓ Every video has captions."); break; }
    }
    setRun(false);
  }
  if (!left && !msg) return <p className="text-sm text-dim">CC · Every video has captions. New uploads get them automatically.</p>;
  return (
    <div className="space-y-1 rounded-xl border border-border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={run || !left} onClick={go} className="min-h-10 rounded-lg bg-accent px-4 font-semibold text-black disabled:opacity-50">
          {run ? `Making captions… ${left} left` : `CC · Make captions for ${left} video${left === 1 ? "" : "s"}`}
        </button>
        <span className="text-dim">{msg || "About 5 seconds per video. New uploads get captions automatically."}</span>
      </div>
      {fails.length > 0 && <p className="text-[12px] text-[#ff9a9a]">Couldn&apos;t caption: {fails.join(", ")}</p>}
    </div>
  );
}
