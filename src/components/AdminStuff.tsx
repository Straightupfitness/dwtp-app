"use client";
import { useEffect, useState } from "react";

/**
 * November 15 (Michael): the sign-in helpers in one pop-up (⚙️ Admin stuff) instead of on her page: send the welcome
 * link, text her a sign-in link, or get a sign-in code. The buttons are passed in from her page.
 */
export default function AdminStuff({ first, children }: { first: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-semibold">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
        Admin stuff
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Admin stuff" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md space-y-3 rounded-[20px] border border-border bg-[#121212] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-baseline justify-between">
              <h2 className="font-[family-name:var(--font-display)] text-xl uppercase">Admin stuff · {first}</h2>
              <button type="button" onClick={() => setOpen(false)} className="min-h-9 px-2 text-dim" aria-label="Close">✕</button>
            </div>
            <div className="flex flex-col gap-2 [&_button]:w-full">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
