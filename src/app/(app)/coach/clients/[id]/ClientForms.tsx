"use client";
import { useState, useTransition } from "react";
import { updateClient, setFocus, openNextRing, signOff } from "./actions";

const input = "mt-1 block w-full rounded-lg border border-border bg-bg px-3 py-2 text-base text-text outline-none focus:border-accent";

export function ProfileForm({ clientId, p, t, programs = [] }: {
  clientId: string;
  p: Record<string, string | number | null>;
  t: { maintenance_calories: number | null; calorie_target: number | null; protein_g: number | null } | null;
  programs?: { id: string; name: string; weeks: number }[];
}) {
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const field = (name: string, label: string, type = "text", value: unknown = p[name]) => (
    <label className="text-sm text-dim">{label}
      <input name={name} type={type} defaultValue={value === null || value === undefined ? "" : String(value)} className={input}
        step={type === "number" ? "any" : undefined} inputMode={type === "number" ? "decimal" : undefined} />
    </label>
  );
  return (
    <form action={(f) => start(async () => { const r = await updateClient(clientId, f); setMsg(r?.error ?? (r?.emailChanged ? "Saved. She now signs in with the new email." : "Saved.")); })} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {field("full_name", "Name")}
        {field("email", "Email (she signs in with this)", "email")}
        {field("phone", "Phone", "tel")}
        <label className="text-sm text-dim">Time zone
          <select name="timezone" defaultValue={String(p.timezone ?? "America/Los_Angeles")} className={input}>
            {[["America/Los_Angeles", "Pacific"], ["America/Denver", "Mountain"], ["America/Phoenix", "Arizona"], ["America/Chicago", "Central"],
              ["America/New_York", "Eastern"], ["America/Anchorage", "Alaska"], ["Pacific/Honolulu", "Hawaii"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            {![...["America/Los_Angeles", "America/Denver", "America/Phoenix", "America/Chicago", "America/New_York", "America/Anchorage", "Pacific/Honolulu"]].includes(String(p.timezone ?? "America/Los_Angeles")) &&
              <option value={String(p.timezone)}>{String(p.timezone)}</option>}
          </select>
        </label>
        {field("program_start", "Program start (a Monday)", "date")}
        <label className="text-sm text-dim">Plan
          <select name="plan" defaultValue={String(p.plan ?? "")} className={input}>
            <option value="">–</option><option value="26_weeks">26 weeks</option><option value="52_weeks">Full year</option><option value="monthly">Monthly</option>
          </select>
        </label>
        <label className="text-sm text-dim">Status
          <select name="status" defaultValue={String(p.status ?? "active")} className={input}>
            {["onboarding", "active", "paused", "completed", "cancelled"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        {field("start_weight_lbs", "Start weight (lbs)", "number")}
        {field("goal_weight_lbs", "Goal weight (lbs)", "number")}
        {field("strength_days_per_week", "Strength days / week", "number")}
        <label className="col-span-2 text-sm text-dim">Workout program
          <select name="workout_program" defaultValue={String(p.workout_program ?? "sltp")} className={input}>
            {programs.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.weeks} weeks)</option>)}
          </select>
        </label>
        {field("workout_start_week", "Start her at program week", "number", p.workout_start_week ?? 1)}
        {field("wake_time", "Wake time", "time")}
        {field("bedtime", "Bedtime", "time")}
        {field("maintenance_calories", "Maintenance kcal", "number", t?.maintenance_calories)}
        {field("calorie_target", "Calorie target", "number", t?.calorie_target)}
        {field("protein_g", "Protein target (g)", "number", t?.protein_g)}
      </div>
      <label className="block text-sm text-dim">Your notes on her (onboarding call, what works). The AI reads these.
        <textarea name="coach_notes" rows={4} defaultValue={String(p.coach_notes ?? "")} className={input} />
      </label>
      <button disabled={pending} className="min-h-11 rounded-lg bg-accent px-5 font-semibold text-black disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
      {msg && <span className="ml-3 text-sm">{msg}</span>}
    </form>
  );
}

export function FocusPicker({ clientId, circles, selected }: {
  clientId: string; circles: { id: string; name: string; counts: boolean }[]; selected: string[];
}) {
  const [sel, setSel] = useState(selected);
  const [pending, start] = useTransition();
  const counted = circles.filter((c) => c.counts && sel.includes(c.id)).length;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {circles.map((c) => {
          const on = sel.includes(c.id);
          return (
            <button key={c.id} type="button" aria-pressed={on} onClick={() => setSel(on ? sel.filter((x) => x !== c.id) : [...sel, c.id])}
              className={`min-h-9 rounded-full border px-3 text-sm ${on ? "border-accent bg-accent text-black" : "border-border"}`}>{c.name}</button>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" disabled={pending} onClick={() => start(() => setFocus(clientId, sel))}
          className="min-h-11 rounded-lg border border-accent px-4 text-sm text-accent disabled:opacity-50">{pending ? "Saving…" : "Save focus circles"}</button>
        <span className={`text-xs ${counted === 3 ? "text-dim" : "text-gold"}`}>{counted} of 3 selected{counted !== 3 ? " (usually 3)" : ""}</span>
      </div>
    </div>
  );
}

export function OpenRingButton({ clientId, circleId, label }: { clientId: string; circleId: string; label: string }) {
  const [pending, start] = useTransition();
  const [ask, setAsk] = useState(false);
  return (
    <button type="button" disabled={pending} onClick={() => (ask ? start(() => openNextRing(clientId, circleId)) : setAsk(true))}
      className="min-h-9 shrink-0 rounded-lg border border-border px-2.5 text-xs disabled:opacity-50">
      {pending ? "Opening…" : ask ? "Tap to confirm" : label}
    </button>
  );
}

export function SignOffButton({ clientId, itemId }: { clientId: string; itemId: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => signOff(clientId, itemId))}
      className="min-h-9 shrink-0 rounded-lg border border-accent px-2.5 text-xs text-accent disabled:opacity-50">{pending ? "…" : "Sign off"}</button>
  );
}
