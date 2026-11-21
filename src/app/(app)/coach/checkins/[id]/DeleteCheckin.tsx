"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCheckin } from "./actions";

/** Two taps to delete a check-in (no pop-up): "Delete" → "Tap again to delete". */
export default function DeleteCheckin({ id, label, goTo, compact = false }: { id: string; label: string; goTo?: string; compact?: boolean }) {
  const [armed, setArmed] = useState(false);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  function click(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 4000); return; }
    start(async () => {
      const r = await deleteCheckin(id);
      if (r?.error) { setErr(r.error); setArmed(false); return; }
      if (goTo) router.push(goTo); else router.refresh();
    });
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={click} disabled={pending} aria-label={`Delete ${label}`}
        className={`${compact ? "min-h-8 px-2 text-[12px]" : "min-h-10 px-3 text-[13px]"} rounded-lg border ${armed ? "border-[#ef4444] bg-[#2a1515] font-semibold text-[#ff9a9a]" : "border-border text-dim hover:text-text"} disabled:opacity-50`}>
        {pending ? "Deleting…" : armed ? "Tap again to delete" : compact ? "🗑" : "🗑 Delete check-in"}
      </button>
      {err && <span className="text-[12px] text-[#ff9a9a]">{err}</span>}
    </span>
  );
}
