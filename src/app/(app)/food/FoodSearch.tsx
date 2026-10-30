"use client";
import { useEffect, useState } from "react";
import { scaleFood, type DbFood, type FoodItem } from "@/lib/food";

/** Search foods and brands, pick one, say how much (eggs, scoops, cups, oz, grams…), add it. */
export default function FoodSearch({ onAdd }: { onAdd: (item: FoodItem) => void }) {
  const [q, setQ] = useState("");
  const [foods, setFoods] = useState<DbFood[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<DbFood | null>(null);
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState(0);

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
    }, 450);
    return () => clearTimeout(t);
  }, [q]);

  if (picked) {
    const units = unitsFor(picked);
    const u = units[Math.min(unit, units.length - 1)];
    const n = Number(qty.replace(",", ".")) || 0;
    const g = n * u.grams;
    const plural = (w: string) => (n === 1 || /s$|[^a-z]$/i.test(w) ? w : `${w}s`);
    const label = u.key === "g" ? `${n} g` : u.key === "oz" ? `${n} oz` : `${n} ${plural(u.word)}`;
    const item = scaleFood(picked, g, label);
    return (
      <div className="space-y-3 rounded-2xl border border-border bg-bg p-3">
        <p className="text-[15px] font-medium">{picked.name}{picked.brand ? <span className="text-dim"> · {picked.brand}</span> : null}</p>
        {/* How much: a number, then eggs / scoops / cups / slices / oz / grams, whatever this food has. */}
        <div className="flex items-end gap-2">
          <label className="w-24 text-xs text-dim">How many
            <input type="number" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)}
              className="mt-1 block min-h-11 w-full rounded-lg border border-[#2a2a2a] bg-card px-3 text-base text-text outline-none focus:border-accent" />
          </label>
          <div className="flex min-w-0 flex-1 flex-wrap gap-1">
            {units.map((x, i) => (
              <button key={x.key + i} type="button" aria-pressed={unit === i} onClick={() => { setUnit(i); setQty(x.key === "g" ? "100" : x.key === "oz" ? "4" : "1"); }}
                className={`min-h-10 rounded-lg border px-2.5 text-xs ${unit === i ? "border-accent bg-accent font-semibold text-black" : "border-border text-dim"}`}>{x.button}</button>
            ))}
          </div>
        </div>
        <p className="text-xs text-[#a8a8a8]">{label}{u.key !== "g" ? ` (${Math.round(g)} g)` : ""}: {item.calories} kcal · {item.protein_g} g protein · {item.fiber_g} g fiber · {item.potassium_mg} mg potassium</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setPicked(null)} className="min-h-11 flex-1 rounded-lg border border-border text-sm">Back</button>
          <button type="button" disabled={!g} onClick={() => { onAdd(item); setPicked(null); setQ(""); setFoods([]); setUnit(0); }}
            className="min-h-11 flex-1 rounded-lg bg-accent text-sm font-semibold text-black disabled:opacity-40">Add</button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search foods or brands, e.g. eggs, Ghost whey" aria-label="Search the food database"
        className="min-h-12 w-full rounded-xl border border-[#2a2a2a] bg-card px-4 text-[15px] outline-none focus:border-accent" />
      {busy && <p className="text-xs text-dim">Searching…</p>}
      {error && <p className="text-xs text-[var(--red)]">{error}</p>}
      {q.trim().length >= 2 && foods.length > 0 && (
        <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-xl border border-border bg-card">
          {foods.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => { const u = unitsFor(f)[0]; setPicked(f); setUnit(0); setQty(u.key === "g" ? "100" : "1"); }} className="flex min-h-12 w-full items-center gap-2 px-3 text-left">
                <span className="flex-1 text-sm">{f.name}{f.brand ? <span className="text-dim"> · {f.brand}</span> : null}</span>
                <span className="shrink-0 text-xs text-dim">{Math.round(f.per100.calories)} kcal/100 g</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-dim">Type a food or a brand. From USDA FoodData Central and Open Food Facts.</p>
    </div>
  );
}

/**
 * The ways to measure this food (October 30: "how do I put how many eggs?"): its own portions first
 * (1 egg, 1 cup, 1 slice, 1 scoop…), then its serving, then oz and grams.
 */
function unitsFor(f: DbFood) {
  const rest = (label: string) => label.replace(/^\s*1\s+/, "").replace(/\s*\([^)]*\)\s*$/, "").trim() || "serving";
  const out: { key: string; button: string; word: string; grams: number }[] = [];
  for (const p of f.portions ?? []) out.push({ key: `p:${p.label}`, button: rest(p.label), word: rest(p.label), grams: p.grams });
  if (f.servingGrams) {
    const w = f.servingLabel ? rest(f.servingLabel.toLowerCase()) : "serving";
    if (!out.some((x) => x.word === w)) out.push({ key: "serving", button: f.servingLabel ? `${w} (${Math.round(f.servingGrams)} g)` : "serving", word: w, grams: f.servingGrams });
  }
  out.push({ key: "oz", button: "oz", word: "oz", grams: 28.35 }, { key: "g", button: "grams", word: "g", grams: 1 });
  return out;
}
