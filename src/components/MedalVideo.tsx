"use client";
import { useEffect, useState } from "react";

const len = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "");

/**
 * November 10: Michael's medal video. A small portrait thumbnail she taps to watch full screen, so it doesn't push
 * the habit list down the page.
 */
export default function MedalVideo({ url, seconds, color, name, compact = false }: { url: string; seconds: number | null; color: string; name: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`flex w-full items-center gap-3 rounded-xl border border-border bg-bg/60 text-left ${compact ? "p-1.5" : "p-2"}`}>
        <span className={`relative shrink-0 overflow-hidden rounded-lg bg-black ${compact ? "h-14 w-8" : "h-20 w-12"}`}>
          <video src={`${url}#t=0.5`} preload="metadata" muted playsInline className="size-full object-cover" aria-hidden="true" tabIndex={-1} />
          <span className="absolute inset-0 grid place-items-center bg-black/25">
            <span className="grid size-6 place-items-center rounded-full text-[10px] text-black" style={{ background: color }}>▶</span>
          </span>
        </span>
        <span className="min-w-0">
          <span className="block text-[14px] font-semibold">Watch Michael explain this medal</span>
          <span className="block text-xs text-dim">{len(seconds)}{seconds ? " · " : ""}Tap to play</span>
        </span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/90 p-4" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label={`Video: ${name}`}>
          <video src={url} controls autoPlay playsInline onClick={(e) => e.stopPropagation()} onEnded={() => setOpen(false)}
            className="max-h-[82dvh] w-auto max-w-full rounded-2xl bg-black" />
          <button type="button" onClick={() => setOpen(false)} className="min-h-11 px-4 text-sm text-[#cfcfcf]">Close ✕</button>
        </div>
      )}
    </>
  );
}
