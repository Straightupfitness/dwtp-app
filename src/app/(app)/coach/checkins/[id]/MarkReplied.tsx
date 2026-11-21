"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markReplied } from "./actions";

/** November 20 (Michael): "Already replied": for check-ins he answered another way. Sends nothing to her. */
export default function MarkReplied({ id }: { id: string }) {
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" disabled={pending} title="Mark as replied (sends nothing to her)"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); start(async () => { const r = await markReplied(id); if (r?.error) setErr(r.error); else router.refresh(); }); }}
        className="min-h-8 whitespace-nowrap rounded-lg border border-black/30 bg-black/10 px-2.5 text-[12px] font-semibold text-black hover:bg-black/20 disabled:opacity-50">
        {pending ? "…" : "✓ Already replied"}
      </button>
      {err && <span className="text-[12px] text-[#7a1010]">{err}</span>}
    </span>
  );
}
