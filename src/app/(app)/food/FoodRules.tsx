"use client";
import { useState, useTransition } from "react";
import { saveFoodRules } from "./actions";

const PRESETS = ["No pork", "No beef", "No red meat", "Gluten-free", "Dairy-free", "Lactose-free", "Vegetarian", "Pescatarian", "No shellfish", "No alcohol", "Nut allergy"];

/**
 * November 18 (Heather): "I wish I could tell the app it's never going to be pork for me." Her food rules: tap the
 * ones that fit and add her own. When the app reads a photo or what she types, it never guesses something that
 * breaks them (sausage = turkey or chicken; bread = gluten-free).
 */
export default function FoodRules({ initial }: { initial: string | null }) {
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState(initial ?? "");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const list = rules.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
  const has = (p: string) => list.some((x) => x.toLowerCase() === p.toLowerCase());
  const toggle = (p: string) => setRules((has(p) ? list.filter((x) => x.toLowerCase() !== p.toLowerCase()) : [...list, p]).join(", "));
  return (
    <div className="rounded-2xl border border-border bg-card">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-12 w-full items-center gap-2 px-3.5 text-left">
        <span className="text-[14px] font-semibold">🍽️ My food rules</span>
        <span className="min-w-0 flex-1 truncate text-[12px] text-dim">{list.length ? list.join(" · ") : "Tell the app what you never eat"}</span>
        <span className="text-dim" aria-hidden="true">{open ? "⌃" : "⌄"}</span>
      </button>
      {open && (
        <div className="space-y-2.5 border-t border-border p-3.5">
          <p className="text-[12px] text-dim">When the app reads your photo or what you type, it follows these. Say &quot;no pork&quot; and a sausage is always turkey or chicken.</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button key={p} type="button" aria-pressed={has(p)} onClick={() => toggle(p)}
                className={`min-h-9 rounded-full border px-3 text-[13px] ${has(p) ? "border-accent bg-accent font-semibold text-black" : "border-border text-dim"}`}>{p}</button>
            ))}
          </div>
          <textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={2} aria-label="Your food rules"
            placeholder="Anything else, e.g. My sausage is always turkey sausage. I use almond milk."
            className="w-full rounded-xl border border-[#2a2a2a] bg-bg p-3 text-[15px] outline-none focus:border-accent" />
          <div className="flex items-center gap-3">
            <button type="button" disabled={pending} onClick={() => start(async () => { const r = await saveFoodRules(rules); setMsg(r?.error ?? "Saved ✓"); })}
              className="min-h-11 rounded-xl bg-accent px-5 text-[14px] font-semibold text-black disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
            {msg && <span className="text-[13px] text-dim">{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
