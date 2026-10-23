"use client";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { totals, type FoodItem } from "@/lib/food";
import { saveMeal } from "./actions";

type Slot = "meal_1" | "meal_2" | "meal_3" | "other";
const SLOTS: { v: Slot; label: string }[] = [
  { v: "meal_1", label: "Meal 1" }, { v: "meal_2", label: "Meal 2" }, { v: "meal_3", label: "Meal 3" }, { v: "other", label: "Other" },
];

/** Shrink a photo to max 1024 px JPEG before upload/analysis. */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.8));
}
const toDataUrl = (b: Blob) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(b); });

type SpeechRec = { lang: string; interimResults: boolean; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; onend: () => void; start: () => void; stop: () => void };

export default function AddMeal({ userId, defaultSlot }: { userId: string; defaultSlot: Slot }) {
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [slot, setSlot] = useState<Slot>(defaultSlot);
  const [items, setItems] = useState<FoodItem[] | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<"" | "analyzing" | "saving">("");
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [extra, setExtra] = useState("");
  const [adding, setAdding] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const usedVoice = useRef(false);

  function reset() {
    setOpen(false); setPhoto(null); setPreview(null); setText(""); setItems(null); setNotes(""); setError(""); usedVoice.current = false;
  }

  async function onPhoto(f: File | undefined) {
    if (!f) return;
    const small = await shrink(f);
    setPhoto(small);
    setPreview(URL.createObjectURL(small));
  }

  function toggleVoice() {
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Rec = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Rec) { setError("Voice isn't available in this browser. Tap the microphone on your keyboard instead."); return; }
    if (listening) { recRef.current?.stop(); return; }
    const rec = new Rec();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onresult = (e) => { usedVoice.current = true; setText((t) => (t ? t + " " : "") + e.results[0][0].transcript); };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  async function analyze() {
    setBusy("analyzing"); setError("");
    try {
      const res = await fetch("/api/food/analyze", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: photo ? await toDataUrl(photo) : undefined, text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setItems(data.items); setNotes(data.notes ?? "");
    } catch (e) { setError((e as Error).message || "Something went wrong."); }
    setBusy("");
  }

  /** She types what's missing ("1 tbsp olive oil") and the AI fills in the numbers. */
  async function addExtra() {
    if (!extra.trim() || !items) return;
    setAdding(true); setError("");
    try {
      const res = await fetch("/api/food/analyze", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (!data.items?.length) throw new Error("Couldn't find that food. Try wording it differently.");
      setItems((list) => [...(list ?? []), ...data.items]);
      setExtra("");
    } catch (e) { setError((e as Error).message || "Something went wrong."); }
    setAdding(false);
  }

  async function save() {
    if (!items) return;
    setBusy("saving"); setError("");
    let photoPath: string | null = null;
    if (photo) {
      photoPath = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await createClient().storage.from("food-photos").upload(photoPath, photo, { contentType: "image/jpeg" });
      if (upErr) photoPath = null;
    }
    const r = await saveMeal({ items, mealSlot: slot, source: photo ? "photo" : usedVoice.current ? "voice" : "text", description: text, photoPath });
    setBusy("");
    if (r?.error) setError(r.error); else reset();
  }

  const edit = (i: number, k: keyof FoodItem, v: string) =>
    setItems((list) => list!.map((it, j) => (j === i ? { ...it, [k]: k === "name" || k === "amount" ? v : Number(v) } : it)));

  if (!open) {
    return <button onClick={() => setOpen(true)} className="w-full rounded-xl bg-accent py-4 text-lg font-semibold text-black">+ Add meal</button>;
  }

  const t = items ? totals(items) : null;
  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex gap-2">
        {SLOTS.map((s) => (
          <button key={s.v} onClick={() => setSlot(s.v)}
            className={`flex-1 rounded-lg border py-2 text-sm ${slot === s.v ? "border-accent text-accent" : "border-border text-dim"}`}>{s.label}</button>
        ))}
      </div>

      {!items && (
        <>
          <label className="block cursor-pointer rounded-lg border border-dashed border-border p-4 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
            {preview ? <img src={preview} alt="Your meal" className="mx-auto max-h-56 rounded-lg" /> : <span>📷 Take or choose a photo</span>}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
          </label>
          <div className="flex gap-2">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
              placeholder="Or say or type what you ate, e.g. “2 eggs, 1 slice sourdough with butter, black coffee”"
              className="flex-1 rounded-lg border border-border bg-bg p-3 text-base outline-none focus:border-accent" />
            <button onClick={toggleVoice} aria-label="Speak your meal"
              className={`w-14 rounded-lg border text-2xl ${listening ? "border-accent bg-accent/20" : "border-border"}`}>🎤</button>
          </div>
          <button disabled={busy !== "" || (!photo && !text.trim())} onClick={analyze}
            className="w-full rounded-lg bg-accent py-3 font-semibold text-black disabled:opacity-50">
            {busy === "analyzing" ? "Estimating…" : "Estimate my meal"}
          </button>
        </>
      )}

      {items && (
        <>
          {notes && <p className="text-sm text-dim">{notes}</p>}
          <div className="space-y-3">
            {items.map((it, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex gap-2">
                  <input value={it.name} onChange={(e) => edit(i, "name", e.target.value)} className="flex-1 rounded border border-border bg-bg px-2 py-1" />
                  <input value={it.amount} onChange={(e) => edit(i, "amount", e.target.value)} className="w-24 rounded border border-border bg-bg px-2 py-1" />
                  <button onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Remove" className="px-2 text-dim">✕</button>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs text-dim">
                  {([["calories", "kcal"], ["protein_g", "protein g"], ["fiber_g", "fiber g"], ["potassium_mg", "potassium mg"]] as const).map(([k, l]) => (
                    <label key={k}>{l}
                      <input type="number" inputMode="decimal" value={it[k]} onChange={(e) => edit(i, k, e.target.value)}
                        className="mt-1 block w-full rounded border border-border bg-bg px-1 py-1 text-sm text-text" />
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <input value={extra} onChange={(e) => setExtra(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addExtra(); }}
                placeholder="Missed something? e.g. 1 tbsp olive oil"
                className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-base outline-none focus:border-accent" />
              <button disabled={adding || !extra.trim()} onClick={addExtra}
                className="rounded-lg bg-accent px-4 font-semibold text-black disabled:opacity-50">{adding ? "…" : "Add"}</button>
            </div>
            <button onClick={() => setItems([...items, { name: "", amount: "", calories: 0, protein_g: 0, fiber_g: 0, potassium_mg: 0 }])}
              className="text-xs text-dim">or enter the numbers yourself</button>
          </div>
          {t && <p className="text-sm">Total: <b>{Math.round(t.calories)}</b> kcal · <b>{t.protein_g.toFixed(1)}</b> g protein · {t.fiber_g.toFixed(1)} g fiber · {Math.round(t.potassium_mg)} mg potassium</p>}
          <div className="flex gap-2">
            <button onClick={() => setItems(null)} className="flex-1 rounded-lg border border-border py-3">Back</button>
            <button disabled={busy !== ""} onClick={save} className="flex-1 rounded-lg bg-accent py-3 font-semibold text-black disabled:opacity-50">
              {busy === "saving" ? "Saving…" : "Save meal"}
            </button>
          </div>
        </>
      )}
      {error && <p className="text-sm text-[var(--red)]">{error}</p>}
      <button onClick={reset} className="w-full text-sm text-dim">Cancel</button>
    </div>
  );
}
