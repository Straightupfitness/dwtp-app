"use client";
import { useEffect, useState } from "react";
import { scaleFood, type DbFood, type FoodItem } from "@/lib/food";

/** Search USDA FoodData Central, pick a food, set the amount, add it. */
export default function FoodSearch({ onAdd }: { onAdd: (item: FoodItem) => void }) {
  const [q, setQ] = useState("");
  const [foods, setFoods] = useState<DbFood[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<DbFood | null>(null);
  const [grams, setGrams] = useState("100");
  // Amount in grams, ounces, or servings (October 29: easier than weighing in grams).
  const [unit, setUnit] = useState<"g" | "oz" | "serving">("g");

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(async () => {
      setBusy(true); setError("");
      try {
        const res = await fetch(`/api/food/search?q=${encodeURIComponent(q.trim())}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setFoods(data.foods);
      } catch (e) { setError((e as Error).message); }
      setBusy(false);
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  if (picked) {
    const qty = Number(grams) || 0;
    const g = unit === "oz" ? qty * 28.35 : unit === "serving" ? qty * (picked.servingGrams ?? 100) : qty;
    const label = unit === "g" ? `${qty} g` : unit === "oz" ? `${qty} oz` : (qty === 1 && picked.servingLabel ? picked.servingLabel : `${qty} serving${qty === 1 ? "" : "s"}`);
    const item = scaleFood(picked, g, label);
    return (
      <div className="space-y-3 rounded-2xl border border-border bg-bg p-3">
        <p className="text-[15px] font-medium">{picked.name}</p>
        <div className="flex items-end gap-2">
          <label className="flex-1 text-xs text-dim">Amount
            <input type="number" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)}
              className="mt-1 block min-h-11 w-full rounded-lg border border-[#2a2a2a] bg-card px-3 text-base text-text outline-none focus:border-accent" />
          </label>
          <div className="flex gap-1 rounded-lg border border-border p-0.5">
            {([["g", "grams"], ["oz", "oz"], ...(picked.servingGrams ? [["serving", "servings"] as const] : [])] as const).map(([v, l]) => (
              <button key={v} type="button" aria-pressed={unit === v} onClick={() => { setUnit(v); setGrams(v === "serving" ? "1" : v === "oz" ? "4" : String(picked.servingGrams ?? 100)); }}
                className={`min-h-10 rounded-md px-2.5 text-xs ${unit === v ? "bg-accent font-semibold text-black" : "text-dim"}`}>{l}</button>
            ))}
          </div>
        </div>
        <p className="text-xs text-[#a8a8a8]">{item.calories} kcal · {item.protein_g} g protein · {item.fiber_g} g fiber · {item.potassium_mg} mg potassium</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setPicked(null)} className="min-h-11 flex-1 rounded-lg border border-border text-sm">Back</button>
          <button type="button" disabled={!g} onClick={() => { onAdd(item); setPicked(null); setQ(""); setFoods([]); setUnit("g"); }}
            className="min-h-11 flex-1 rounded-lg bg-accent text-sm font-semibold text-black disabled:opacity-40">Add</button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search foods, e.g. avocado" aria-label="Search the food database"
        className="min-h-12 w-full rounded-xl border border-[#2a2a2a] bg-card px-4 text-[15px] outline-none focus:border-accent" />
      {busy && <p className="text-xs text-dim">Searching…</p>}
      {error && <p className="text-xs text-[var(--red)]">{error}</p>}
      {q.trim().length >= 2 && foods.length > 0 && (
        <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-xl border border-border bg-card">
          {foods.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => { setPicked(f); setUnit(f.servingGrams ? "serving" : "g"); setGrams(f.servingGrams ? "1" : "100"); }} className="flex min-h-12 w-full items-center gap-2 px-3 text-left">
                <span className="flex-1 text-sm">{f.name}{f.brand ? <span className="text-dim"> · {f.brand}</span> : null}</span>
                <span className="text-xs text-dim">{Math.round(f.per100.calories)} kcal/100 g</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-dim">From USDA FoodData Central</p>
    </div>
  );
}
