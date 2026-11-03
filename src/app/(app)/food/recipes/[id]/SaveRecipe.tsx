"use client";
import { useState, useTransition } from "react";
import { toggleSavedRecipe } from "../../actions";

/** ♥ Save this recipe for another time (November 2). Saved ones show under "♥ Saved" on Recipes. */
export default function SaveRecipe({ id, saved }: { id: number; saved: boolean }) {
  const [on, setOn] = useState(saved);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" disabled={pending} aria-pressed={on} onClick={() => start(async () => {
        const next = !on; setOn(next); setErr("");
        const r = await toggleSavedRecipe(id, next);
        if (r?.error) { setOn(!next); setErr(r.error); }
      })} className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-semibold ${on ? "border-[#fb7185] bg-[#2a1218] text-[#fb7185]" : "border-[#3a3a3a] text-[#cfcfcf]"}`}>
        {on ? "♥ Saved" : "♡ Save recipe"}
      </button>
      {err && <span className="text-[12px] text-dim">{err}</span>}
    </span>
  );
}
