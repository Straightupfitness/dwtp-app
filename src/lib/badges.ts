/**
 * Badges (October 29): 21 days in a row of something hard. Once earned, a badge is hers for good and shows
 * next to her name in Community. Steps count only for clients whose iPhone syncs them (no typing in).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Daily, Day, Goals } from "./daily";

export const STREAK = 21;

export type BadgeKey = "steps" | "workouts" | "calories" | "protein" | "fiber" | "potassium" | "water";
export type BadgeDef = {
  key: BadgeKey; name: string; rule: string; color: string;
  /** Daily badges: did this day count? ("min" ones can count today already; "range" ones only once the day is over.) */
  day?: { test: (d: Day, g: Goals) => boolean; kind: "min" | "range" };
};

export const BADGES: BadgeDef[] = [
  { key: "workouts", name: "Iron Streak", rule: "Every workout on your plan, 3 weeks in a row", color: "#fb7185" },
  { key: "steps", name: "Trailblazer", rule: "10,000 steps a day, 21 days in a row", color: "#a3e635",
    day: { kind: "min", test: (d) => (d.steps ?? 0) >= 10000 } },
  { key: "water", name: "Gallon Club", rule: "A gallon of water a day, 21 days in a row", color: "#38bdf8",
    day: { kind: "min", test: (d) => (d.water ?? 0) >= 128 } },
  { key: "calories", name: "Bullseye", rule: "Calories within 100 of your target, 21 days in a row", color: "#f5a623",
    day: { kind: "range", test: (d, g) => !!g.calories && d.meals > 0 && Math.abs(d.calories - g.calories) <= 100 } },
  { key: "protein", name: "Protein Pro", rule: "Protein within 10 g of your target, 21 days in a row", color: "#f97316",
    day: { kind: "range", test: (d, g) => d.meals > 0 && Math.abs(d.protein - g.protein) <= 10 } },
  { key: "fiber", name: "Gut Guardian", rule: "Fiber within 5 g of your target, 21 days in a row", color: "#22c55e",
    day: { kind: "range", test: (d, g) => d.meals > 0 && Math.abs(d.fiber - g.fiber) <= 5 } },
  { key: "potassium", name: "Electrolyte Elite", rule: "Potassium within 500 mg of your target, 21 days in a row", color: "#c084fc",
    day: { kind: "range", test: (d, g) => d.meals > 0 && Math.abs(d.potassium - g.potassium) <= 500 } },
];
export const BADGE = Object.fromEntries(BADGES.map((b) => [b.key, b])) as Record<BadgeKey, BadgeDef>;

export type BadgeStatus = { def: BadgeDef; current: number; best: number; goal: number; unit: "days" | "weeks"; earned: boolean };

/** Her current and best run for each badge, from her daily numbers. */
export function badgeStatus(data: Daily, earned: Set<string>): BadgeStatus[] {
  return BADGES.map((def) => {
    let current = 0, best = 0, run = 0;
    if (def.day) {
      const test = def.day.test, days = data.days;
      for (const d of days) {
        if (d.date === data.today && def.day.kind === "range") continue; // today's not over yet
        if (test(d, data.goals)) { run++; best = Math.max(best, run); } else if (d.date !== data.today) run = 0;
      }
      // Current run: back from today (if it already counts) or yesterday.
      let i = days.length - 1;
      if (!(def.day.kind === "min" && test(days[i], data.goals))) i--;
      while (i >= 0 && test(days[i], data.goals)) { current++; i--; }
      return { def, current, best, goal: STREAK, unit: "days" as const, earned: earned.has(def.key) || best >= STREAK };
    }
    // Workouts: whole weeks where she did every workout on her plan. This week counts once it's done.
    for (const w of data.workoutWeeks) {
      const ok = w.planned > 0 && w.done >= w.planned;
      if (ok) { run++; best = Math.max(best, run); } else if (w.week !== data.currentWeek) run = 0;
    }
    const ws = data.workoutWeeks;
    let i = ws.length - 1;
    if (i >= 0 && !(ws[i].planned > 0 && ws[i].done >= ws[i].planned)) i--;
    while (i >= 0 && ws[i].planned > 0 && ws[i].done >= ws[i].planned) { current++; i--; }
    return { def, current, best, goal: 3, unit: "weeks" as const, earned: earned.has(def.key) || best >= 3 };
  });
}

/** Save any badge she just earned (with the service key: badges can't be added from the browser). Returns the new ones. */
export async function awardBadges(admin: SupabaseClient, clientId: string, status: BadgeStatus[], had: Set<string>) {
  const fresh = status.filter((s) => s.best >= s.goal && !had.has(s.def.key)).map((s) => s.def.key);
  if (fresh.length) await admin.from("badges_earned").upsert(fresh.map((badge) => ({ client_id: clientId, badge })), { onConflict: "client_id,badge", ignoreDuplicates: true });
  return fresh;
}
