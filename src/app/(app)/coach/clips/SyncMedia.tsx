"use client";
import { useState, useTransition } from "react";
import { syncRecipeMedia } from "./actions";

/** Re-check which recipes have their photo and video uploaded (runs by itself after an upload too). */
export default function SyncMedia() {
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <p className="text-sm">
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await syncRecipeMedia(); setMsg(r && "videos" in r ? `${r.photos} photos and ${r.videos} videos are on their recipes.` : r?.error ?? ""); })}
        className="min-h-10 rounded-lg border border-border px-3 text-[13px] font-semibold disabled:opacity-50">{pending ? "Checking…" : "Re-check recipe photos & videos"}</button>
      {msg && <span className="ml-2">{msg}</span>}
    </p>
  );
}
