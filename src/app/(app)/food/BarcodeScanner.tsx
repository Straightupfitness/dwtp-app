"use client";
import { useEffect, useRef, useState } from "react";
import { scaleFood, type DbFood, type FoodItem } from "@/lib/food";

/** Scan a packaged food's barcode with the camera; look it up in Open Food Facts (then USDA). */
export default function BarcodeScanner({ onAdd, onClose }: { onAdd: (item: FoodItem) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [food, setFood] = useState<DbFood | null>(null);
  const [servings, setServings] = useState("1");
  const [grams, setGrams] = useState("100");
  const [status, setStatus] = useState("Point the camera at the barcode");
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");

  async function lookup(code: string) {
    setStatus("Looking it up…"); setError("");
    const res = await fetch(`/api/food/barcode?code=${encodeURIComponent(code)}`);
    const data = await res.json();
    if (!res.ok) { setError(data.error); setStatus(""); return; }
    setFood(data.food); setGrams(String(data.food.servingGrams ?? 100));
  }

  useEffect(() => {
    let stop: (() => void) | null = null, cancelled = false;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints({ video: { facingMode: "environment" } }, video.current!, (result) => {
          if (result && !cancelled) { cancelled = true; controls.stop(); lookup(result.getText()); }
        });
        stop = () => controls.stop();
      } catch {
        setStatus(""); setError("I couldn't open the camera. Allow camera access, or type the barcode number below.");
      }
    })();
    return () => { cancelled = true; stop?.(); };
  }, []);

  if (food) {
    const perServing = !!food.servingGrams;
    const g = perServing ? (Number(servings) || 0) * food.servingGrams! : Number(grams) || 0;
    const item = scaleFood(food, g, perServing ? `${servings} × ${food.servingLabel ?? `${food.servingGrams} g`}` : undefined);
    return (
      <div className="space-y-3 rounded-2xl border border-border bg-bg p-3">
        <p className="text-[15px] font-medium">{food.name}{food.brand ? <span className="text-dim"> · {food.brand}</span> : null}</p>
        <label className="block text-xs text-dim">{perServing ? `Servings (${food.servingLabel ?? `${food.servingGrams} g`})` : "Amount (grams)"}
          <input type="number" inputMode="decimal" value={perServing ? servings : grams} onChange={(e) => (perServing ? setServings : setGrams)(e.target.value)}
            className="mt-1 block min-h-11 w-full rounded-lg border border-[#2a2a2a] bg-card px-3 text-base text-text outline-none focus:border-accent" />
        </label>
        <p className="text-xs text-[#a8a8a8]">{item.calories} kcal · {item.protein_g} g protein · {item.fiber_g} g fiber</p>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-lg border border-border text-sm">Cancel</button>
          <button type="button" disabled={!g} onClick={() => { onAdd(item); onClose(); }} className="min-h-11 flex-1 rounded-lg bg-accent text-sm font-semibold text-black disabled:opacity-40">Add</button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-bg p-3">
      <video ref={video} muted playsInline className="aspect-[4/3] w-full rounded-xl bg-black object-cover" />
      {status && <p className="text-xs text-dim">{status}</p>}
      {error && <p className="text-xs text-[var(--red)]">{error}</p>}
      <form onSubmit={(e) => { e.preventDefault(); if (manual.trim()) lookup(manual); }} className="flex gap-2">
        <input value={manual} onChange={(e) => setManual(e.target.value)} inputMode="numeric" placeholder="Or type the barcode number" aria-label="Barcode number"
          className="min-h-11 flex-1 rounded-lg border border-[#2a2a2a] bg-card px-3 text-base outline-none focus:border-accent" />
        <button className="min-h-11 rounded-lg border border-border px-3 text-sm">Look up</button>
      </form>
      <button type="button" onClick={onClose} className="min-h-10 w-full text-sm text-dim">Cancel</button>
      <p className="text-[11px] text-dim">From Open Food Facts</p>
    </div>
  );
}
