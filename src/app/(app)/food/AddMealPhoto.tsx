"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { shrinkImage } from "@/lib/image";
import { setMealPhoto, uploadFoodPhoto } from "./actions";

/** November 19 (Michael): the photo spot on a meal with no picture. Tap it to add one after logging. */
export default function AddMealPhoto({ id, icon }: { id: string; icon: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  async function pick(f?: File) {
    if (!f) return;
    setBusy(true); setErr(false);
    try {
      const small = await shrinkImage(f, 1024, 0.8);
      const fd = new FormData();
      fd.append("photo", small, "meal.jpg");
      const up = await uploadFoodPhoto(fd);
      const r = up.path ? await setMealPhoto(id, up.path) : { error: up.error };
      if (r?.error) setErr(true); else router.refresh();
    } catch { setErr(true); }
    setBusy(false);
  }
  return (
    <button type="button" onClick={() => input.current?.click()} disabled={busy} aria-label="Add a photo to this meal"
      className="relative grid size-[72px] shrink-0 place-items-center rounded-xl border border-dashed border-[#3a3a3a] bg-[#1b1b1b] text-dim">
      {busy ? <span className="text-[11px]">Adding…</span> : (
        <span className="flex flex-col items-center gap-0.5">
          {icon}
          <span className={`text-[10px] font-semibold ${err ? "text-[var(--red)]" : "text-accent"}`}>{err ? "Try again" : "+ Photo"}</span>
        </span>
      )}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
    </button>
  );
}
