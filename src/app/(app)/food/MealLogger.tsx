"use client";
import { useEffect, useRef, useState } from "react";
import { photoTakenAt } from "@/lib/exif";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage } from "@/lib/image";
import { parseQty, totals, type FoodItem } from "@/lib/food";
import { saveMeal, updateMeal, deleteGoTo } from "./actions";
import { EDIT_EVENT, type MealToEdit } from "./EditMeal";
import FoodSearch from "./FoodSearch";
import BarcodeScanner from "./BarcodeScanner";

type Slot = "meal_1" | "meal_2" | "meal_3" | "other";
const SLOTS: { v: Slot; label: string }[] = [{ v: "meal_1", label: "Meal 1" }, { v: "meal_2", label: "Meal 2" }, { v: "meal_3", label: "Meal 3" }, { v: "other", label: "Other" }];
export type GoTo = { id: string; name: string; items: FoodItem[] };
type SpeechRec = { lang: string; interimResults: boolean; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; onend: () => void; start: () => void; stop: () => void };

const toDataUrl = (b: Blob) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(b); });
const Cam = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>;
const Mic = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>;
const Spark = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f5a623" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="mt-0.5 shrink-0"><path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z" /><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" /></svg>;

const fmtQty = (n: number) => (Math.abs(n - Math.round(n)) < 0.01 ? String(Math.round(n)) : String(Math.round(n * 100) / 100));
/** The same food, k times as much: every number scales together. */
function scaleItem(base: FoodItem, k: number, amount: string): FoodItem {
  const r1 = (x: number) => Math.round(x * k * 10) / 10;
  return { ...base, amount, calories: Math.round(base.calories * k), protein_g: r1(base.protein_g), fiber_g: r1(base.fiber_g), potassium_mg: Math.round(base.potassium_mg * k) };
}

export default function MealLogger({ userId, defaultSlot, goTos, day, isToday }: { userId: string; defaultSlot: Slot; goTos: GoTo[]; day: string; isToday: boolean }) {
  // Logging on a past day she's looking at: start at noon that day (she can change the time).
  const defaultWhen = () => (isToday ? null : new Date(`${day}T12:00:00`));
  const [mode, setMode] = useState<"home" | "describe" | "review">("home");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [slot, setSlot] = useState<Slot>(defaultSlot);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [notes, setNotes] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [adder, setAdder] = useState<"type" | "search" | "scan">("type");
  const [when, setWhen] = useState<Date | null>(defaultWhen); // null = now
  const [extra, setExtra] = useState("");
  const [saveAs, setSaveAs] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "estimating" | "adding" | "saving">("");
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [manage, setManage] = useState(false);
  const [editId, setEditId] = useState<string | null>(null); // set when she's changing a meal she already saved
  const rec = useRef<SpeechRec | null>(null);
  const voice = useRef(false);

  // "Edit" on a saved meal opens it here, with its foods, meal, time and photo.
  useEffect(() => {
    const open = (e: Event) => {
      const m = (e as CustomEvent<MealToEdit>).detail;
      setEditId(m.id); setItems(m.items); setSlot(m.slot); setWhen(new Date(m.eatenAt)); setPreview(m.photoUrl); setPhoto(null);
      setSavedId(null); setText(""); setNotes(""); setSaveAs(null); setEditing(null); setExtra(""); setError(""); setAdder("type"); setMode("review");
    };
    window.addEventListener(EDIT_EVENT, open);
    return () => window.removeEventListener(EDIT_EVENT, open);
  }, []);

  function reset() {
    setMode("home"); setAdder("type"); setWhen(defaultWhen()); setPhoto(null); setPreview(null); setText(""); setItems([]); setNotes(""); setSavedId(null);
    setEditing(null); setExtra(""); setSaveAs(null); setError(""); voice.current = false; setSlot(defaultSlot); setEditId(null);
  }
  async function estimate(image: Blob | null, description: string) {
    setMode("review"); setBusy("estimating"); setError("");
    try {
      const res = await fetch("/api/food/analyze", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: image ? await toDataUrl(image) : undefined, text: description }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setItems(data.items ?? []); setNotes(data.notes ?? "");
      if (!data.items?.length) setError("I couldn't find food in that. Add the items below.");
    } catch (e) { setError((e as Error).message || "Something went wrong."); }
    setBusy("");
  }
  async function onPhoto(f?: File) {
    if (!f) return;
    // A photo from her library: log it at the time she took it (if it's from the last week).
    const taken = await photoTakenAt(f);
    setWhen(taken && Date.now() - taken.getTime() > 10 * 60_000 && Date.now() - taken.getTime() < 7 * 86_400_000 ? taken : defaultWhen());
    const small = await shrinkImage(f, 1024, 0.8);
    setPhoto(small); setPreview(URL.createObjectURL(small));
    estimate(small, "");
  }
  function toggleVoice() {
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Rec = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Rec) { setError("Tap the microphone on your keyboard to speak instead."); return; }
    if (listening) { rec.current?.stop(); return; }
    const r = new Rec(); r.lang = "en-US"; r.interimResults = false;
    r.onresult = (e) => { voice.current = true; setText((t) => (t ? t + " " : "") + e.results[0][0].transcript); };
    r.onend = () => setListening(false);
    rec.current = r; setListening(true); r.start();
  }
  async function addTyped() {
    if (!extra.trim()) return;
    setBusy("adding"); setError("");
    try {
      const res = await fetch("/api/food/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: extra }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (!data.items?.length) throw new Error("Couldn't find that food. Try wording it differently.");
      setItems((l) => [...l, ...data.items]); setExtra("");
    } catch (e) { setError((e as Error).message); }
    setBusy("");
  }
  async function save() {
    setBusy("saving"); setError("");
    if (editId) {
      const r = await updateMeal(editId, { items, mealSlot: slot, eatenAt: when ? when.toISOString() : null, saveAs });
      setBusy("");
      if (r?.error) setError(r.error); else reset();
      return;
    }
    let photoPath: string | null = null;
    if (photo) {
      photoPath = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error: e } = await createClient().storage.from("food-photos").upload(photoPath, photo, { contentType: "image/jpeg" });
      if (e) photoPath = null;
    }
    const r = await saveMeal({ items, mealSlot: slot, eatenAt: when ? when.toISOString() : null, source: savedId ? "saved_meal" : photo ? "photo" : voice.current ? "voice" : "text",
      description: text, photoPath, savedMealId: savedId, saveAs });
    setBusy("");
    if (r?.error) setError(r.error); else reset();
  }
  // The food as it was when she opened it to edit: amount changes scale from this, so numbers never drift.
  const base = useRef<FoodItem | null>(null);
  const openItem = (i: number | null) => { base.current = i === null ? null : items[i]; setEditing(i); };
  const edit = (i: number, k: keyof FoodItem, v: string) => {
    if (k === "amount" && base.current) {
      // "6 oz" → "8 oz": calories, protein, fiber and potassium follow (October 29 feedback).
      const was = parseQty(base.current.amount), now = parseQty(v);
      if (was && now && was.unit === now.unit) { const b = base.current; setItems((l) => l.map((it, j) => (j === i ? scaleItem(b, now.n / was.n, v) : it))); return; }
    }
    if (k !== "amount" && k !== "name") base.current = null; // she typed her own numbers: those win
    setItems((l) => l.map((it, j) => (j === i ? { ...it, [k]: k === "name" || k === "amount" ? v : Number(v) } : it)));
  };
  /** Servings buttons: ½×, 1×, 1½×, 2× of the amount she opened it with. */
  const times = (i: number, k: number) => {
    const b = base.current ?? items[i];
    base.current = b;
    const q = parseQty(b.amount);
    const amount = q ? `${fmtQty(q.n * k)} ${q.rest}`.trim() : k === 1 ? b.amount : `${fmtQty(k)} × ${b.amount}`;
    setItems((l) => l.map((it, j) => (j === i ? scaleItem(b, k, amount) : it)));
  };

  const slotLabel = SLOTS.find((s) => s.v === slot)!.label;
  const input = "min-h-11 w-full rounded-lg border border-[#2a2a2a] bg-bg px-3 text-base text-text outline-none focus:border-accent";

  if (mode === "home") {
    return (
      <div className="space-y-2">
        <p className="text-[13px] text-[#a8a8a8]">Add <b className="text-text">{slotLabel}</b></p>
        <div className="grid grid-cols-3 gap-2">
          <label className="flex min-h-[118px] cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl bg-accent px-2 text-center text-black">
            <Cam /><span className="text-base font-semibold">Snap it</span>
            <span className="text-[11px] leading-tight text-black/70">Take a picture, or pick one from your photos.</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
          </label>
          <button type="button" onClick={() => setMode("describe")} className="flex min-h-[118px] flex-col items-center justify-center gap-1 rounded-2xl border border-accent bg-card px-2 text-center">
            <span className="text-accent"><Mic /></span><span className="text-base font-semibold">Say it</span>
            <span className="text-[11px] leading-tight text-[#a8a8a8]">Speak in what you ate.</span>
          </button>
          <button type="button" onClick={() => { setItems([]); setSavedId(null); setText(""); setNotes(""); setPhoto(null); setPreview(null); setAdder("search"); setMode("review"); }}
            className="flex min-h-[118px] flex-col items-center justify-center gap-1 rounded-2xl border border-[#2a2a2a] bg-card px-2 text-center">
            <span className="text-accent"><Pencil /></span><span className="text-base font-semibold">Manual</span>
            <span className="text-[11px] leading-tight text-[#a8a8a8]">Log it yourself, ingredient by ingredient.</span>
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {goTos.length > 0 && <span className="flex shrink-0 items-center text-[12px] font-semibold uppercase tracking-[0.1em] text-accent">★ Favorites</span>}
          {goTos.map((g) => (
            <button key={g.id} type="button" onClick={() => { setItems(g.items); setSavedId(g.id); setText(g.name); setNotes(""); setMode("review"); }}
              className="min-h-10 shrink-0 rounded-full border border-[#2a2a2a] px-3.5 text-[13px]">+ {g.name}</button>
          ))}
          {goTos.length > 0
            ? <button type="button" onClick={() => setManage(!manage)} className="min-h-10 shrink-0 rounded-full px-2 text-[13px] text-dim">{manage ? "Done" : "Edit"}</button>
            : <span className="py-2 text-xs text-dim">★ Save a meal as a favorite (like your daily breakfast) to log it again with one tap.</span>}
        </div>
        {manage && (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {goTos.map((g) => (
              <li key={g.id} className="flex items-center justify-between px-3 py-2 text-sm">{g.name}
                <button type="button" onClick={() => deleteGoTo(g.id)} className="min-h-9 text-xs text-[var(--red)]">Remove</button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="text-sm text-[var(--red)]">{error}</p>}
      </div>
    );
  }

  if (mode === "describe") {
    return (
      <div className="space-y-3 rounded-2xl border border-border bg-card p-3.5">
        <p className="font-semibold">What did you eat?</p>
        <div className="flex gap-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} autoFocus aria-label="Describe your meal"
            placeholder="e.g. 2 eggs, 1 slice sourdough with butter, black coffee"
            className="flex-1 rounded-xl border border-[#2a2a2a] bg-bg p-3 text-base outline-none focus:border-accent" />
          <button type="button" onClick={toggleVoice} aria-label={listening ? "Stop listening" : "Speak your meal"}
            className={`grid w-14 place-items-center rounded-xl border ${listening ? "border-accent bg-accent/20 text-accent" : "border-[#2a2a2a] text-text"}`}><Mic /></button>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={reset} className="min-h-12 flex-1 rounded-xl border border-border">Cancel</button>
          <button type="button" disabled={!text.trim()} onClick={() => estimate(null, text)} className="min-h-12 flex-1 rounded-xl bg-accent font-semibold text-black disabled:opacity-40">Estimate</button>
        </div>
        {error && <p className="text-sm text-[var(--red)]">{error}</p>}
      </div>
    );
  }

  const t = totals(items);
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-bg">
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button type="button" onClick={reset} className="flex min-h-11 items-center gap-1 px-2 text-[15px] text-[#a8a8a8]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>Back
        </button>
        <p className="font-[family-name:var(--font-display)] text-lg uppercase">{editId ? "Edit your meal" : "Check your meal"}</p>
        <span className="w-16" />
      </div>

      <div className="mx-auto w-full max-w-md flex-1 space-y-3.5 overflow-y-auto px-4 pb-4 pt-1">
        {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
        {preview && <img src={preview} alt="Your meal" className="max-h-44 w-full rounded-[18px] object-cover" />}

        <div className="grid grid-cols-4 gap-1 rounded-[14px] border border-border bg-card p-1">
          {SLOTS.map((s) => (
            <button key={s.v} type="button" onClick={() => setSlot(s.v)} aria-pressed={slot === s.v}
              className={`min-h-10 rounded-[10px] text-[13px] ${slot === s.v ? "bg-accent font-semibold text-black" : "text-dim"}`}>{s.label}</button>
          ))}
        </div>

        <WhenPicker when={when} onChange={setWhen} />

        {busy === "estimating" && <p className="rounded-[14px] border border-border bg-card p-4 text-center text-sm text-[#a8a8a8]">Estimating your meal…</p>}
        {notes && (
          <div className="flex gap-2.5 rounded-[14px] border border-[#2b2418] bg-[#161310] p-3">
            <Spark /><p className="text-[13px] leading-relaxed text-[#d9c9a8]">{notes} Change anything that&apos;s off.</p>
          </div>
        )}

        {!items.length && busy !== "estimating" && (
          <p className="rounded-[14px] border border-dashed border-[#2a2a2a] p-4 text-center text-sm text-[#a8a8a8]">Add each ingredient below. Search the food database, scan a barcode, or type it in.</p>
        )}

        {items.length > 0 && (
          <div className="divide-y divide-border rounded-2xl border border-border bg-card px-3.5">
            {items.map((it, i) => editing === i ? (
              <div key={i} className="space-y-2 py-3">
                <div className="flex gap-2">
                  <input value={it.name} onChange={(e) => edit(i, "name", e.target.value)} aria-label="Food" className={input} />
                  <input value={it.amount} onChange={(e) => edit(i, "amount", e.target.value)} aria-label="Amount" className={`${input} w-28`} />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-dim">Servings</span>
                  {([[0.5, "½×"], [1, "1×"], [1.5, "1½×"], [2, "2×"], [3, "3×"]] as const).map(([k, l]) => (
                    <button key={k} type="button" onClick={() => times(i, k)} className="min-h-9 flex-1 rounded-lg border border-[#2a2a2a] text-[13px]">{l}</button>
                  ))}
                </div>
                <p className="-mt-0.5 text-[11px] text-dim">Change the amount (6 oz → 8 oz) and every number below changes with it.</p>
                <div className="grid grid-cols-4 gap-2">
                  {([["calories", "kcal"], ["protein_g", "protein g"], ["fiber_g", "fiber g"], ["potassium_mg", "K mg"]] as const).map(([k, l]) => (
                    <label key={k} className="text-[11px] text-dim">{l}
                      <input type="number" inputMode="decimal" value={it[k]} onChange={(e) => edit(i, k, e.target.value)} className={`${input} mt-1 px-2 text-sm`} />
                    </label>
                  ))}
                </div>
                <div className="flex justify-between">
                  <button type="button" onClick={() => { setItems(items.filter((_, j) => j !== i)); openItem(null); }} className="min-h-10 text-sm text-[var(--red)]">Remove</button>
                  <button type="button" onClick={() => openItem(null)} className="min-h-10 text-sm font-semibold text-accent">Done</button>
                </div>
              </div>
            ) : (
              <button key={i} type="button" onClick={() => openItem(i)} className="flex min-h-[58px] w-full items-center gap-2.5 text-left">
                <span className="flex-1"><span className="block text-[15px] font-medium">{it.name}</span><span className="block text-xs text-dim">{it.amount}</span></span>
                <span className="text-right"><span className="block text-sm font-semibold">{Math.round(it.calories)}</span><span className="block text-xs text-[#a8a8a8]">{it.protein_g} g protein</span></span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="2" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>
              </button>
            ))}
          </div>
        )}

        {busy !== "estimating" && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-3 gap-1 rounded-[14px] border border-border bg-card p-1">
              {([["type", "Type it"], ["search", "Search foods"], ["scan", "Scan barcode"]] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setAdder(v)} aria-pressed={adder === v}
                  className={`min-h-10 rounded-[10px] text-[13px] ${adder === v ? "bg-[#2a2a2a] font-semibold text-text" : "text-dim"}`}>{l}</button>
              ))}
            </div>
            {adder === "type" && (
              <div className="flex gap-2">
                <input value={extra} onChange={(e) => setExtra(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addTyped(); }}
                  placeholder={items.length ? "Missed something? e.g. 1 tbsp butter" : "e.g. 6 oz salmon"} aria-label="Add a food by typing it"
                  className="min-h-12 flex-1 rounded-xl border border-[#2a2a2a] bg-card px-4 text-[15px] outline-none focus:border-accent" />
                <button type="button" disabled={busy !== "" || !extra.trim()} onClick={addTyped} className="min-h-12 rounded-xl border border-accent px-4 font-semibold text-accent disabled:opacity-40">{busy === "adding" ? "…" : "Add"}</button>
              </div>
            )}
            {adder === "search" && <FoodSearch onAdd={(it) => setItems((l) => [...l, it])} />}
            {adder === "scan" && <BarcodeScanner onAdd={(it) => setItems((l) => [...l, it])} onClose={() => setAdder("type")} />}
          </div>
        )}

        {items.length > 0 && !savedId && (
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" checked={saveAs !== null} onChange={(e) => setSaveAs(e.target.checked ? "" : null)} className="size-5 accent-[var(--accent)]" />
            ★ Save as a favorite (log it again with one tap)
          </label>
        )}
        {saveAs !== null && (
          <input value={saveAs} onChange={(e) => setSaveAs(e.target.value)} placeholder="Name it, e.g. Daily breakfast" aria-label="Favorite meal name"
            className="min-h-11 w-full rounded-xl border border-[#2a2a2a] bg-card px-4 text-[15px] outline-none focus:border-accent" />
        )}
        {error && <p className="text-sm text-[var(--red)]">{error}</p>}
      </div>

      <div className="border-t border-border bg-[#0f0f0f] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-md space-y-2.5 px-4 pt-3">
          <div className="flex justify-between text-[13px] text-[#a8a8a8]">
            <span><b className="text-base text-text">{Math.round(t.calories)}</b> kcal</span>
            <span><b className="text-text">{Math.round(t.protein_g)} g</b> protein</span>
            <span><b className="text-text">{Math.round(t.fiber_g)} g</b> fiber</span>
            <span><b className="text-text">{(t.potassium_mg / 1000).toFixed(1)}k</b> mg K</span>
          </div>
          <button type="button" disabled={busy !== "" || !items.length || (saveAs !== null && !saveAs.trim())} onClick={save}
            className="min-h-[54px] w-full rounded-[14px] bg-accent text-[17px] font-semibold text-black disabled:opacity-40">
            {busy === "saving" ? "Saving…" : editId ? "Save changes" : `Save ${slotLabel}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Pencil() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg>;
}

const now = () => new Date();
const dayLabel = (i: number) => (i === 0 ? "Today" : i === 1 ? "Yesterday" : new Date(now().getTime() - i * 86_400_000).toLocaleDateString("en-US", { weekday: "long" }));
const daysAgo = (d: Date) => Math.round((new Date(now().toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);

/** When she ate it: now by default (or the past day she's looking at); any day in the last week, or the older day she's on. */
function WhenPicker({ when, onChange }: { when: Date | null; onChange: (d: Date | null) => void }) {
  const d = when ?? now();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dayOffset = daysAgo(d);
  const set = (offset: number, time: string) => {
    const [h, m] = time.split(":").map(Number);
    const x = now(); x.setHours(h, m, 0, 0); x.setDate(x.getDate() - offset);
    onChange(x > now() ? null : x);
  };
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return (
    <div className="flex items-center gap-2 rounded-[14px] border border-border bg-card px-3 py-2">
      <span className="text-[13px] text-[#a8a8a8]">Eaten</span>
      <select aria-label="Day" value={dayOffset} onChange={(e) => set(Number(e.target.value), time)}
        className="min-h-10 flex-1 rounded-lg border border-[#2a2a2a] bg-bg px-2 text-[15px] outline-none focus:border-accent">
        {Array.from({ length: 7 }, (_, i) => (
          <option key={i} value={i}>{dayLabel(i)}</option>
        ))}
        {dayOffset > 6 && <option value={dayOffset}>{d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</option>}
      </select>
      <input type="time" aria-label="Time" value={time} onChange={(e) => e.target.value && set(dayOffset, e.target.value)}
        className="min-h-10 rounded-lg border border-[#2a2a2a] bg-bg px-2 text-[15px] outline-none focus:border-accent" />
      {when && <button type="button" onClick={() => onChange(null)} className="min-h-10 px-1 text-xs text-accent">Now</button>}
    </div>
  );
}
