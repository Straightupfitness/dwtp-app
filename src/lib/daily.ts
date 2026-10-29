/**
 * Her numbers day by day (October 29): food, weight, steps, water and workouts, plus her goals.
 * Feeds her Progress tab, Michael's view of each client, and the badges.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { DAILY_TARGETS } from "./food";
import { programWeek, todayIn } from "./program";
import { daysFor } from "./workouts";

export const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);

export type Day = {
  date: string; meals: number; calories: number; protein: number; fiber: number; potassium: number;
  weight: number | null; steps: number | null; water: number | null;
};
export type Goals = {
  startWeight: number | null; goalWeight: number | null;
  calories: number | null; protein: number; fiber: number; potassium: number; water: number; steps: number;
};
export type WorkoutWeek = { week: number; planned: number; done: number };

export async function loadDaily(supabase: SupabaseClient, clientId: string, span = 90) {
  const { data: p } = await supabase.from("profiles")
    .select("timezone, program_start, start_weight_lbs, goal_weight_lbs, water_goal_oz, step_goal, strength_days_per_week, workout_program, workout_start_week")
    .eq("id", clientId).single();
  const tz = p?.timezone ?? "America/Los_Angeles";
  const today = todayIn(tz);
  const from = addDays(today, -(span - 1));

  const [{ data: food }, { data: weights }, { data: health }, { data: water }, { data: t }, { data: sessions }] = await Promise.all([
    supabase.from("food_logs").select("eaten_at, calories, protein_g, fiber_g, potassium_mg").eq("client_id", clientId)
      .gte("eaten_at", addDays(from, -1) + "T00:00:00Z").order("eaten_at").limit(2000),
    supabase.from("weight_logs").select("log_date, weight_lbs").eq("client_id", clientId).order("log_date"),
    supabase.from("health_days").select("day, steps").eq("client_id", clientId).gte("day", from),
    supabase.from("water_days").select("day, oz").eq("client_id", clientId).gte("day", from),
    supabase.from("nutrition_targets").select("calorie_target, protein_g, fiber_g, potassium_mg").eq("client_id", clientId).maybeSingle(),
    supabase.from("workout_sessions").select("program_week, workouts!inner(kind)").eq("client_id", clientId).not("completed_at", "is", null).eq("workouts.kind", "strength"),
  ]);

  const byDay = new Map<string, Day>();
  for (let i = 0; i < span; i++) {
    const date = addDays(from, i);
    byDay.set(date, { date, meals: 0, calories: 0, protein: 0, fiber: 0, potassium: 0, weight: null, steps: null, water: null });
  }
  for (const f of food ?? []) {
    const d = byDay.get(todayIn(tz, new Date(f.eaten_at)));
    if (!d) continue;
    d.meals++; d.calories += f.calories ?? 0; d.protein += Number(f.protein_g ?? 0); d.fiber += Number(f.fiber_g ?? 0); d.potassium += f.potassium_mg ?? 0;
  }
  for (const w of weights ?? []) { const d = byDay.get(w.log_date); if (d) d.weight = Number(w.weight_lbs); }
  for (const h of health ?? []) { const d = byDay.get(h.day); if (d) d.steps = h.steps; }
  for (const w of water ?? []) { const d = byDay.get(w.day); if (d) d.water = w.oz; }
  const days = [...byDay.values()].map((d) => ({ ...d, protein: Math.round(d.protein), fiber: Math.round(d.fiber), calories: Math.round(d.calories) }));

  const goals: Goals = {
    startWeight: p?.start_weight_lbs != null ? Number(p.start_weight_lbs) : (weights?.[0] ? Number(weights[0].weight_lbs) : null),
    goalWeight: p?.goal_weight_lbs != null ? Number(p.goal_weight_lbs) : null,
    calories: t?.calorie_target ?? null,
    protein: t?.protein_g ?? DAILY_TARGETS.protein_g,
    fiber: t?.fiber_g ?? DAILY_TARGETS.fiber_g,
    potassium: t?.potassium_mg ?? DAILY_TARGETS.potassium_mg,
    water: p?.water_goal_oz ?? 128,
    steps: p?.step_goal ?? 10000,
  };

  // Workouts: for each program week so far, the strength workouts on her plan and how many she finished.
  const current = programWeek(p?.program_start ?? null, today);
  const doneBy = new Map<number, number>();
  for (const s of sessions ?? []) doneBy.set(s.program_week as number, (doneBy.get(s.program_week as number) ?? 0) + 1);
  const workoutWeeks: WorkoutWeek[] = [];
  if (current >= 1) {
    const programId = (p?.workout_program as string | null) ?? "sltp";
    const offset = Math.max(0, ((p?.workout_start_week as number | null) ?? 1) - 1);
    const { data: phases } = await supabase.from("program_phases")
      .select("weeks, first_week, phase_workouts(day, from_week, to_week, workouts(kind))").eq("program", programId);
    type PW = { day: number | null; from_week: number | null; to_week: number | null; workouts: { kind: string } | null };
    for (let w = 1; w <= current; w++) {
      const pw = w + offset;
      const ph = (phases ?? []).find((x) => pw >= x.first_week && pw < x.first_week + x.weeks);
      const wop = ph ? pw - ph.first_week + 1 : 0;
      const days = ph ? [...new Set(((ph.phase_workouts ?? []) as unknown as PW[])
        .filter((l) => l.workouts?.kind === "strength" && l.day && (l.from_week ?? 1) <= wop && wop <= (l.to_week ?? 99)).map((l) => l.day!))] : [];
      workoutWeeks.push({ week: w, planned: daysFor(p?.strength_days_per_week ?? null, days).length, done: Math.min(doneBy.get(w) ?? 0, 99) });
    }
  }
  return { today, tz, days, goals, workoutWeeks, currentWeek: current, weights: (weights ?? []).map((w) => ({ date: w.log_date as string, lbs: Number(w.weight_lbs) })) };
}
export type Daily = Awaited<ReturnType<typeof loadDaily>>;

/** Michael's at-a-glance compliance for the last 14 finished days (and last 4 finished workout weeks). */
export function compliance(d: Daily) {
  const past = d.days.filter((x) => x.date < d.today).slice(-14);
  const n = past.length || 1;
  const logged = past.filter((x) => x.meals > 0);
  const g = d.goals;
  const weeks = d.workoutWeeks.filter((w) => w.week < d.currentWeek).slice(-4);
  const planned = weeks.reduce((s, w) => s + w.planned, 0), done = weeks.reduce((s, w) => s + Math.min(w.done, w.planned), 0);
  const synced = past.some((x) => x.steps);
  return [
    { label: "Food logged", value: logged.length, of: n, note: "days" },
    { label: "Calories on target", value: g.calories ? logged.filter((x) => Math.abs(x.calories - g.calories!) <= 100).length : null, of: logged.length, note: "± 100 of logged days" },
    { label: "Protein on target", value: logged.filter((x) => x.protein >= g.protein - 10).length, of: logged.length, note: `${g.protein - 10} g+ of logged days` },
    { label: "Weigh-ins", value: past.filter((x) => x.weight !== null).length, of: n, note: "days" },
    { label: "Workouts", value: planned ? done : null, of: planned, note: "last 4 weeks" },
    { label: "Water goal", value: past.filter((x) => (x.water ?? 0) >= g.water).length, of: n, note: "days" },
    { label: "Step goal", value: synced ? past.filter((x) => (x.steps ?? 0) >= g.steps).length : null, of: n, note: synced ? "days" : "not synced" },
  ];
}
