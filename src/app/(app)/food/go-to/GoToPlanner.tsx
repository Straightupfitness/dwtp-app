"use client";
import { useRef, useState } from "react";
import { DAYS, itemCost, macros, mealCost, mealMissing, money, shoppingList, type GoItem, type GoMeal, type Period } from "@/lib/go-to";
import { deleteGoMeal, saveGoMeal } from "./actions";

const display = "font-[family-name:var(--font-display)] uppercase";
const field = "min-h-10 min-w-0 rounded-lg border border-[#2a2a2a] bg-bg px-2.5 text-[15px] outline-none focus:border-accent";
const blankItem = (): GoItem => ({ name: "", qty: null, unit: "g", brand: "", store: "", pkg_qty: null, pkg_price: null, kcal: null, protein: null, fiber: null });
const label = (p: number) => (p <= 3 ? `Meal ${p}` : `Backup ${p - 3}`);
const n = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
const fmtQty = (q: number) => (q >= 100 ? Math.round(q).toLocaleString() : String(Math.round(q * 10) / 10));

type Saved = { id: string; name: string; items: { name: string; amount: string }[] };

/**
 * November 26 (Michael): her 3 go-to meals, the meals the whole food side of the program is built around. She (or the
 * AI) fills in each ingredient, how much, the brand and store, and the package she buys; the app works out a shopping
 * list and "How much will this cost?" per week or month. Everything is editable; it saves as she types.
 */
export default function GoToPlanner({ initial, saved, defaultCurrency, tz }: { initial: GoMeal[]; saved: Saved[]; defaultCurrency: string; tz: string }) {
  const cur0 = initial[0]?.currency || defaultCurrency;
  const [currency, setCurrency] = useState(cur0);
  const [meals, setMeals] = useState<GoMeal[]>(() => {
    const byPos = new Map(initial.map((m) => [m.position, m]));
    const out = [1, 2, 3].map((p) => byPos.get(p) ?? { position: p, name: "", items: [], currency: cur0 });
    for (const p of [4, 5, 6]) if (byPos.has(p)) out.push(byPos.get(p)!);
    return out;
  });
  const [period, setPeriod] = useState<Period>("week");
  const [status, setStatus] = useState("");
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const persist = (m: GoMeal, cur = currency) => {
    const t = timers.current.get(m.position);
    if (t) clearTimeout(t);
    timers.current.set(m.position, setTimeout(async () => {
      setStatus("Saving…");
      const r = await saveGoMeal(m.position, m.name, m.items, cur);
      setStatus(r && "error" in r && r.error ? r.error : "Saved");
    }, 700));
  };
  const update = (pos: number, f: (m: GoMeal) => GoMeal) => setMeals((all) => all.map((m) => {
    if (m.position !== pos) return m;
    const next = f(m); persist(next); return next;
  }));
  const changeCurrency = (c: string) => { setCurrency(c); for (const m of meals) if (m.name || m.items.length) persist(m, c); };

  const main = meals.filter((m) => m.position <= 3);
  const days = DAYS[period];
  const total = main.reduce((s, m) => s + mealCost(m), 0) * days;
  const missing = main.reduce((s, m) => s + mealMissing(m), 0);
  const list = shoppingList(main, period);
  const [got, setGot] = useState<Set<string>>(new Set());
  const copyList = async () => {
    const text = list.map(([store, rows]) => `${store}\n${rows.map((r) => `- ${r.name}${r.brand ? ` (${r.brand})` : ""}: ${r.packs !== null ? `${r.packs} × ${fmtQty(r.pkg_qty!)} ${r.unit}` : `${fmtQty(r.need)} ${r.unit}`}`).join("\n")}`).join("\n\n");
    try { await navigator.clipboard.writeText(text); setStatus("Shopping list copied"); } catch { setStatus("Couldn't copy"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
        <span className="text-dim">{status || "Saves as you type."}</span>
        <label className="flex items-center gap-1.5 text-dim">Currency
          <select value={currency} onChange={(e) => changeCurrency(e.target.value)} className={`${field} min-h-8 py-0 text-[14px]`}>
            {["$", "€", "£", "CA$", "A$"].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>

      {meals.map((m) => <MealCard key={m.position} meal={m} currency={currency} saved={saved} tz={tz} period={period}
        onChange={(f) => update(m.position, f)}
        onRemove={m.position > 3 ? async () => { setMeals((all) => all.filter((x) => x.position !== m.position)); await deleteGoMeal(m.position); } : undefined} />)}

      {meals.length < 6 && (
        <button type="button" onClick={() => { const p = [4, 5, 6].find((x) => !meals.some((m) => m.position === x))!; setMeals((all) => [...all, { position: p, name: "", items: [], currency }]); }}
          className="min-h-11 w-full rounded-xl border border-dashed border-[#3a3a3a] text-[14px] font-semibold text-accent">+ Add a backup meal</button>
      )}

      {/* How much will this cost? */}
      <section id="cost" className="scroll-mt-20 space-y-3 rounded-[18px] border border-accent/40 bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className={`${display} text-xl`}>How much will this cost?</h2>
          <span className="flex overflow-hidden rounded-lg border border-border text-[13px]" role="group" aria-label="Per week or per month">
            {(["week", "month"] as const).map((p) => <button key={p} type="button" onClick={() => setPeriod(p)} aria-pressed={period === p} className={`min-h-8 px-3 font-semibold ${period === p ? "bg-accent text-black" : "text-[#cfcfcf]"}`}>Per {p}</button>)}
          </span>
        </div>
        <p className="text-[13px] text-dim">If you eat your 3 go-to meals every day for a {period} ({days} days).</p>
        <ul className="divide-y divide-border">
          {main.map((m) => (
            <li key={m.position} className="flex items-center justify-between py-2 text-[15px]">
              <span className="min-w-0 truncate">{m.name || label(m.position)}</span>
              <span className="shrink-0 font-semibold tabular-nums">{m.items.length ? money(mealCost(m) * days, currency) : "–"}</span>
            </li>
          ))}
          <li className="flex items-center justify-between py-2.5 text-[17px]">
            <b>Total per {period}</b><b className="tabular-nums text-accent">{money(total, currency)}</b>
          </li>
        </ul>
        {period === "week" ? <p className="text-[12px] text-dim">About {money(total / 7, currency)} a day · {money((total / 7) * 30, currency)} a month</p>
          : <p className="text-[12px] text-dim">About {money(total / 30, currency)} a day · {money((total / 30) * 7, currency)} a week</p>}
        {missing > 0 && <p className="text-[12px] text-[#e7d3a8]">{missing} ingredient{missing === 1 ? " is" : "s are"} missing an amount, package size or price, so {missing === 1 ? "it isn't" : "they aren't"} counted yet.</p>}

        <div className="flex items-center justify-between gap-2 pt-2">
          <h3 className={`${display} text-[16px]`}>Shopping list · {period}</h3>
          {list.length > 0 && <button type="button" onClick={copyList} className="min-h-8 rounded-lg border border-border px-2.5 text-[12px] font-semibold">Copy list</button>}
        </div>
        {!list.length && <p className="text-[13px] text-dim">Add ingredients with amounts to your meals and your list shows up here.</p>}
        {list.map(([store, rows]) => (
          <div key={store} className="space-y-1">
            <p className="flex justify-between text-[12px] uppercase tracking-[0.1em] text-accent"><span>{store}</span>
              <span className="tabular-nums">{money(rows.reduce((s, r) => s + (r.spend ?? 0), 0), currency)}</span></p>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {rows.map((r) => {
                const k = `${store}|${r.name}|${r.brand}`, on = got.has(k);
                return (
                  <li key={k}>
                    <label className={`flex min-h-11 items-center gap-2.5 px-3 py-1.5 text-[14px] ${on ? "text-dim line-through" : ""}`}>
                      <input type="checkbox" checked={on} onChange={() => setGot((s) => { const x = new Set(s); if (x.has(k)) x.delete(k); else x.add(k); return x; })} className="size-4 accent-[var(--accent)]" />
                      <span className="min-w-0 flex-1"><span className="block truncate">{r.name}{r.brand ? <span className="text-dim"> · {r.brand}</span> : null}</span>
                        <span className="block text-[12px] text-dim">{r.packs !== null ? `Buy ${r.packs} × ${fmtQty(r.pkg_qty!)} ${r.unit}` : `${fmtQty(r.need)} ${r.unit}`} · you use {fmtQty(r.need)} {r.unit}</span></span>
                      <span className="shrink-0 tabular-nums">{r.spend !== null ? money(r.spend, currency) : "–"}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {list.length > 0 && <p className="text-[12px] text-dim">Store totals are what you&apos;d pay at the register (whole packages), so they can be a bit more than the meal costs above. Prices are estimates; tap any number in your meals to fix it.</p>}
      </section>
    </div>
  );
}

function MealCard({ meal, currency, saved, tz, period, onChange, onRemove }: {
  meal: GoMeal; currency: string; saved: Saved[]; tz: string; period: Period;
  onChange: (f: (m: GoMeal) => GoMeal) => void; onRemove?: () => void;
}) {
  const [describe, setDescribe] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const setItem = (k: number, patch: Partial<GoItem>) => onChange((m) => ({ ...m, items: m.items.map((it, j) => (j === k ? { ...it, ...patch } : it)) }));
  const ai = async (text?: string) => {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/food/go-to", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, name: meal.name, items: text ? [] : meal.items, currency, tz }) });
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || "Try again.");
      onChange((m) => ({ ...m, name: m.name || j.name || "", items: j.items }));
      setDescribe("");
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  const fromSaved = (id: string) => {
    const s = saved.find((x) => x.id === id);
    if (!s) return;
    onChange((m) => ({ ...m, name: m.name || s.name }));
    void ai(`${s.name}: ${s.items.map((i) => `${i.name} (${i.amount})`).join(", ")}`);
  };
  const mc = macros(meal), cost = mealCost(meal);
  const isMain = meal.position <= 3;
  return (
    <section className="space-y-3 rounded-[18px] border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className={`${display} shrink-0 text-[15px] text-accent`}>{label(meal.position)}</span>
        <input value={meal.name} onChange={(e) => onChange((m) => ({ ...m, name: e.target.value }))} placeholder={isMain ? "Name it (Yogurt bowl, MVP…)" : "Name your backup"} className={`${field} flex-1`} aria-label={`${label(meal.position)} name`} />
        {onRemove && <button type="button" onClick={onRemove} className="min-h-10 px-2 text-[13px] text-dim" aria-label="Remove this backup meal">✕</button>}
      </div>

      {!meal.items.length && (
        <div className="space-y-2">
          <textarea value={describe} onChange={(e) => setDescribe(e.target.value)} rows={2} placeholder="Describe it: 250 g Fage 0% Greek yogurt, 1 scoop whey, a cup of raspberries, 15 g chia seeds. From Costco."
            className={`${field} w-full py-2`} aria-label="Describe this meal" />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || !describe.trim()} onClick={() => ai(describe)} className="min-h-10 rounded-xl bg-accent px-4 text-[14px] font-semibold text-black disabled:opacity-40">{busy ? "Working…" : "✨ Build it for me"}</button>
            {saved.length > 0 && (
              <select defaultValue="" disabled={busy} onChange={(e) => { if (e.target.value) fromSaved(e.target.value); }} className={`${field} min-h-10 max-w-[60%] text-[14px]`} aria-label="Start from a saved meal">
                <option value="">or start from a saved meal…</option>
                {saved.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            <button type="button" onClick={() => onChange((m) => ({ ...m, items: [blankItem()] }))} className="min-h-10 px-2 text-[13px] text-accent underline">or type it in myself</button>
          </div>
        </div>
      )}

      {meal.items.map((it, k) => {
        const c = itemCost(it);
        return (
          <div key={k} className="space-y-1.5 rounded-xl border border-[#262626] p-2.5">
            <div className="flex gap-1.5">
              <input value={it.name} onChange={(e) => setItem(k, { name: e.target.value })} placeholder="Ingredient" className={`${field} flex-1`} aria-label="Ingredient" />
              <input value={it.qty ?? ""} onChange={(e) => setItem(k, { qty: n(e.target.value) })} inputMode="decimal" placeholder="Amt" className={`${field} w-16 text-right`} aria-label="Amount in the meal" />
              <input value={it.unit} onChange={(e) => setItem(k, { unit: e.target.value })} placeholder="g" className={`${field} w-16`} aria-label="Unit" />
              <button type="button" onClick={() => onChange((m) => ({ ...m, items: m.items.filter((_, j) => j !== k) }))} className="min-h-10 shrink-0 px-1.5 text-dim" aria-label={`Remove ${it.name || "ingredient"}`}>✕</button>
            </div>
            <div className="flex gap-1.5">
              <input value={it.brand} onChange={(e) => setItem(k, { brand: e.target.value })} placeholder="Brand" className={`${field} flex-1 text-[14px]`} aria-label="Brand" />
              <input value={it.store} onChange={(e) => setItem(k, { store: e.target.value })} placeholder="Store" className={`${field} flex-1 text-[14px]`} aria-label="Store" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-dim">
              <span>Package</span>
              <input value={it.pkg_qty ?? ""} onChange={(e) => setItem(k, { pkg_qty: n(e.target.value) })} inputMode="decimal" placeholder="size" className={`${field} min-h-9 w-20 text-right text-[14px]`} aria-label="Package size" />
              <span>{it.unit || "units"} for {currency}</span>
              <input value={it.pkg_price ?? ""} onChange={(e) => setItem(k, { pkg_price: n(e.target.value) })} inputMode="decimal" placeholder="price" className={`${field} min-h-9 w-20 text-right text-[14px]`} aria-label="Package price" />
              <span className="ml-auto tabular-nums text-text">{c !== null ? `${money(c, currency)} / meal` : ""}</span>
            </div>
            {(it.kcal || it.protein) ? <p className="text-[11px] text-dim">≈ {Math.round(Number(it.kcal) || 0)} kcal · {Math.round(Number(it.protein) || 0)} g protein{it.fiber ? ` · ${Math.round(Number(it.fiber))} g fiber` : ""}</p> : null}
          </div>
        );
      })}

      {meal.items.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onChange((m) => ({ ...m, items: [...m.items, blankItem()] }))} className="min-h-10 rounded-xl border border-border px-3 text-[13px] font-semibold">+ Add an ingredient</button>
            <button type="button" disabled={busy} onClick={() => ai()} className="min-h-10 rounded-xl border border-accent px-3 text-[13px] font-semibold text-accent disabled:opacity-40">{busy ? "Working…" : "✨ Fill in sizes & prices"}</button>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-2 text-[13px]">
            <span className={mc.protein >= 40 && mc.fiber >= 10 ? "text-[#7ee2a8]" : "text-dim"}>
              {Math.round(mc.kcal)} kcal · <b className={mc.protein >= 40 ? "text-[#7ee2a8]" : "text-[#e7d3a8]"}>{Math.round(mc.protein)} g protein</b> · {Math.round(mc.fiber)} g fiber
              {isMain && mc.protein > 0 && mc.protein < 40 ? " · aim for 40 g+" : ""}
            </span>
            <span className="tabular-nums"><b>{money(cost, currency)}</b> <span className="text-dim">a meal · {money(cost * DAYS[period], currency)} a {period}</span></span>
          </div>
        </>
      )}
      {err && <p className="text-[13px] text-[#ff9a9a]">{err}</p>}
    </section>
  );
}
