"use client";
import { useEffect, useState } from "react";
import { scaleFood, type DbFood, type FoodItem } from "@/lib/food";

const r1 = (x: number) => Math.round(x * 10) / 10;
const fmtK = (k: number) => (k === 0.5 ? "½" : k === 1.5 ? "1½" : String(k));
/** "2 links" × 1.5 → "3 links"; anything it can't read becomes "1½ × 2 links". */
function times(amount: string, k: number) {
  if (k === 1) return amount;
  const m = amount.match(/^\s*(\d+(?:\.\d+)?)\s*(.*)$/);
  if (m) { const n = Number(m[1]) * k; return `${Math.round(n * 100) / 100} ${m[2]}`.trim(); }
  return `${fmtK(k)} × ${amount}`;
}

/**
 * Search foods and brands, pick one, say how much (eggs, scoops, cups, oz, grams…), add it.
 * November 18 (Heather): her own foods come first ("Your foods"), the ones she logged before, so she never re-enters
 * them: tap, pick how much compared with last time, add.
 */
export default function FoodSearch({ onAdd, mine = [] }: { onAdd: (item: FoodItem) => void; mine?: FoodItem[] }) {
  const [mineAt, setMineAt] = useState<FoodItem | null>(null);
  const [k, setK] = useState(1);
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

  if (mineAt) {
    const item: FoodItem = { ...mineAt, amount: times(mineAt.amount, k), calories: Math.round(mineAt.calories * k), protein_g: r1(mineAt.protein_g * k), fiber_g: r1(mineAt.fiber_g * k), potassium_mg: Math.round(mineAt.potassium_mg * k) };
    return (
      <div className="space-y-3 rounded-2xl border border-accent/60 bg-bg p-3">
        <p className="text-[15px] font-medium">{mineAt.name} <span className="text-[12px] text-dim">· last time {mineAt.amount}</span></p>
        <div className="flex flex-wrap gap-1.5">
          {[0.5, 1, 1.5, 2, 3].map((x) => (
            <button key={x} type="button" aria-pressed={k === x} onClick={() => setK(x)}
              className={`min-h-10 rounded-lg border px-3 text-[13px] ${k === x ? "border-accent bg-accent font-semibold text-black" : "border-border text-dim"}`}>{x === 1 ? "Same as last time" : `${fmtK(x)}×`}</button>
          ))}
        </div>
        <p className="text-xs text-[#a8a8a8]">{item.amount}: {item.calories} kcal · {item.protein_g} g protein · {item.fiber_g} g fiber · {item.potassium_mg} mg potassium</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setMineAt(null)} className="min-h-11 flex-1 rounded-lg border border-border text-sm">Back</button>
          <button type="button" onClick={() => { onAdd(item); setMineAt(null); setK(1); setQ(""); setFoods([]); }} className="min-h-11 flex-1 rounded-lg bg-accent text-sm font-semibold text-black">Add</button>
        </div>
      </div>
    );
  }
  const query = q.trim().toLowerCase();
  const myHits = query.length >= 1 ? mine.filter((f) => f.name.toLowerCase().includes(query)).slice(0, 8) : mine.slice(0, 10);
  const myList = myHits.length > 0 && (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">{query ? "Your foods" : "Your usual foods"}</p>
      <ul className="divide-y divide-border rounded-xl border border-accent/40 bg-card">
        {myHits.map((f) => (
          <li key={f.name}>
            <button type="button" onClick={() => { setMineAt(f); setK(1); }} className="flex min-h-12 w-full items-center gap-2 px-3 text-left">
              <span className="flex-1 text-sm">{f.name} <span className="text-dim">· {f.amount}</span></span>
              <span className="shrink-0 text-xs text-dim">{f.calories} kcal</span>
              <span className="shrink-0 text-accent" aria-hidden="true">+</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

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
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={mine.length ? "Search your foods, or any food or brand" : "Search foods or brands, e.g. eggs, Ghost whey"} aria-label="Search the food database"
        className="min-h-12 w-full rounded-xl border border-[#2a2a2a] bg-card px-4 text-[15px] outline-none focus:border-accent" />
      {myList}
      {busy && <p className="text-xs text-dim">Searching…</p>}
      {error && <p className="text-xs text-[var(--red)]">{error}</p>}
      {q.trim().length >= 2 && foods.length > 0 && myHits.length > 0 && <p className="pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-dim">All foods</p>}
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
