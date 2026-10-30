"use client";
import { useState } from "react";
import { importHistory, importWorkouts, type HistoryPart, type WorkoutPart } from "./history";

type Food = [string, number | null, string, number, number];
type Client = { id: number; email: string; first: string; last: string; weights: [string, number][]; weightGoal: number | null; steps: [string, number][];
  days: NonNullable<HistoryPart["days"]> };

/** Her most-repeated meals (3+ times) become ★ favorites: the top 5. */
function favoritesOf(c: Client): NonNullable<HistoryPart["favorites"]> {
  const seen = new Map<string, { n: number; foods: Food[]; fiber: number; potassium: number }>();
  for (const d of c.days) for (const m of d.meals) {
    const foods = m.foods as Food[];
    if (foods.length < 2) continue;
    const key = foods.map((f) => f[0].toLowerCase()).sort().join("|");
    const kcal = foods.reduce((s, f) => s + (f[3] || 0), 0), share = d.kcal ? kcal / d.kcal : 0;
    const prev = seen.get(key);
    seen.set(key, { n: (prev?.n ?? 0) + 1, foods, fiber: (d.fiber ?? 0) * share, potassium: (d.potassium ?? 0) * share });
  }
  const tidy = (s: string) => s.replace(/\s+by\s+.*$/i, "").replace(/\b(raw|cooked|without salt)\b/gi, "").replace(/\s+/g, " ").trim();
  return [...seen.values()].filter((x) => x.n >= 3).sort((a, b) => b.n - a.n).slice(0, 5)
    .map((x) => ({ name: x.foods.slice(0, 2).map((f) => tidy(f[0])).join(" & ") + (x.foods.length > 2 ? " +" : ""), foods: x.foods, fiber: x.fiber, potassium: x.potassium }));
}

/** Pick "dwtp-trainerize-history.json" (weigh-ins, steps, meals) or "dwtp-trainerize-workouts.json" (workouts and sets). Safe to run again. */
export default function HistoryImport() {
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const add = (s: string) => setLog((l) => [...l, s]);
  async function run(file: File) {
    setBusy(true); setLog(["Reading…"]);
    try {
      const parsed = JSON.parse(await file.text()) as (Client | { email: string; first: string; last: string; workouts: WorkoutPart["workouts"] })[];
      if (parsed.length && "workouts" in parsed[0]) {
        let w = 0, st = 0;
        for (const c of parsed as { email: string; first: string; last: string; workouts: WorkoutPart["workouts"] }[]) {
          const name = `${c.first} ${c.last}`.trim();
          let cw = 0, cs = 0, skipped = false;
          for (let i = 0; i < c.workouts.length; i += 60) {
            const r = await importWorkouts({ email: c.email, workouts: c.workouts.slice(i, i + 60) });
            if (r && "skipped" in r) { skipped = true; break; }
            if (r && "error" in r && r.error) throw new Error(`${name}: ${r.error}`);
            if (r && "workouts" in r) { cw += r.workouts ?? 0; cs += r.sets ?? 0; }
          }
          w += cw; st += cs;
          add(skipped ? `${name}: not in the app (${c.email}), skipped` : `${name}: ${cw} workouts, ${cs} sets`);
        }
        add(`Done: ${w} workouts and ${st} sets for ${parsed.length} clients.`);
        setBusy(false); return;
      }
      const all = parsed as Client[];
      let tot = { w: 0, s: 0, m: 0, f: 0, skip: 0 };
      for (const c of all) {
        const name = `${c.first} ${c.last}`.trim();
        const base = { email: c.email, tzId: c.id };
        const r0 = await importHistory({ ...base, weights: c.weights, weightGoal: c.weightGoal, steps: c.steps });
        if (r0 && "skipped" in r0) { add(`${name}: not in the app (${c.email}), skipped`); continue; }
        if (r0 && "error" in r0 && r0.error) throw new Error(`${name}: ${r0.error}`);
        let meals = 0, skipped = 0;
        for (let i = 0; i < c.days.length; i += 40) {
          const r = await importHistory({ ...base, days: c.days.slice(i, i + 40) });
          if (r && "error" in r && r.error) throw new Error(`${name}: ${r.error}`);
          if (r && "meals" in r) { meals += r.meals ?? 0; skipped += r.daysSkipped ?? 0; }
        }
        const fav = favoritesOf(c);
        const rf = fav.length ? await importHistory({ ...base, favorites: fav }) : null;
        const favs = rf && "favorites" in rf ? rf.favorites ?? 0 : 0;
        tot = { w: tot.w + c.weights.length, s: tot.s + c.steps.length, m: tot.m + meals, f: tot.f + favs, skip: tot.skip + skipped };
        add(`${name}: ${c.weights.length} weigh-ins, ${c.steps.length} step days, ${meals} meals${skipped ? ` (${skipped} days already logged here, kept)` : ""}, ${favs} favorites`);
      }
      add(`Done: ${tot.w} weigh-ins, ${tot.s} step days, ${tot.m} meals and ${tot.f} favorites for ${all.length} clients.`);
    } catch (e) { add(`Stopped: ${(e as Error).message}. Import again to pick up where it left off.`); }
    setBusy(false);
  }
  return (
    <div className="space-y-2">
      <label className="flex min-h-[80px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[16px] border-2 border-dashed border-[#3a3a3a] bg-card p-4 text-center">
        <span className="text-[15px] font-semibold">Import client history: choose &ldquo;dwtp-trainerize-history.json&rdquo;, then &ldquo;dwtp-trainerize-workouts.json&rdquo;</span>
        <span className="text-[13px] text-dim">Weigh-ins, steps, meals and favorites; then workouts with every set. One file at a time. Safe to import again.</span>
        <input type="file" accept="application/json,.json" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) run(f); e.target.value = ""; }} />
      </label>
      {log.length > 0 && <ul className="max-h-72 space-y-0.5 overflow-y-auto rounded-xl border border-border p-2.5 text-[12px]">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>}
      {busy && <p className="text-xs text-dim">Importing… keep this page open.</p>}
    </div>
  );
}
