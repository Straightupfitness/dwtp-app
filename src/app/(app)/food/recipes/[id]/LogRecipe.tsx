"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logRecipe } from "../../actions";

const SLOTS = [["meal_1", "Meal 1"], ["meal_2", "Meal 2"], ["meal_3", "Meal 3"], ["other", "Other"]] as const;

/** Log this recipe: how many servings, which meal, and optionally save it as a favorite. */
export default function LogRecipe({ id, kcal, protein, servingsChange }: { id: number; kcal: number; protein: number; servingsChange?: (n: number) => void }) {
  const [n, setN] = useState(1);
  const [slot, setSlot] = useState<(typeof SLOTS)[number][0]>("meal_1");
  const [fav, setFav] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = (v: number) => { const x = Math.max(0.5, Math.min(6, v)); setN(x); servingsChange?.(x); };
  return (
    <div className="space-y-3 rounded-[18px] border border-accent bg-[#1a1408] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-semibold">Servings you ate</span>
        <span className="flex items-center gap-2">
          <button type="button" onClick={() => set(n - 0.5)} aria-label="Fewer servings" className="grid size-10 place-items-center rounded-full border border-border text-lg">−</button>
          <span className="w-10 text-center text-lg font-semibold tabular-nums">{n}</span>
          <button type="button" onClick={() => set(n + 0.5)} aria-label="More servings" className="grid size-10 place-items-center rounded-full border border-border text-lg">+</button>
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1 rounded-[12px] border border-border bg-card p-1">
        {SLOTS.map(([v, l]) => (
          <button key={v} type="button" onClick={() => setSlot(v)} aria-pressed={slot === v} className={`min-h-10 rounded-[9px] text-[13px] ${slot === v ? "bg-accent font-semibold text-black" : "text-dim"}`}>{l}</button>
        ))}
      </div>
      <label className="flex items-center gap-2.5 text-sm"><input type="checkbox" checked={fav} onChange={(e) => setFav(e.target.checked)} className="size-5 accent-[var(--accent)]" />★ Also save as a favorite</label>
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await logRecipe(id, n, slot, fav); if (r?.error) setMsg(r.error); else { setMsg("Logged."); router.push("/food"); } })}
        className="min-h-[52px] w-full rounded-[14px] bg-accent text-[16px] font-semibold text-black disabled:opacity-50">
        {pending ? "Logging…" : `Log it · ${Math.round(kcal * n)} kcal · ${Math.round(protein * n)} g protein`}
      </button>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
