/** What Michael sees next to a check-in, and what the AI reply draft is built from (docs 26 and 28). */
import type { SupabaseClient } from "@supabase/supabase-js";
import { todayIn } from "./program";
import { loadProgram } from "./circles";

const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);

export type MealFood = { calories: number; protein: number; items: string[] };
export type DayFood = { date: string; meals: number; calories: number; protein: number; fiber: number; items: string[]; list: MealFood[] };

export async function weekData(supabase: SupabaseClient, clientId: string, week: number) {
  const { data: p } = await supabase.from("profiles")
    .select("full_name, timezone, program_start, plan, start_weight_lbs, goal_weight_lbs, strength_days_per_week, wake_time, bedtime, coach_notes")
    .eq("id", clientId).single();
  const tz = p?.timezone ?? "America/Los_Angeles";
  const start = p?.program_start ? addDays(p.program_start, (week - 1) * 7) : todayIn(tz);
  const end = addDays(start, 6);

  const [{ data: weights }, { data: food }, { data: target }, { data: tw }, { data: assessment }, { data: prev }, state] = await Promise.all([
    supabase.from("weight_logs").select("log_date, weight_lbs").eq("client_id", clientId).gte("log_date", addDays(start, -21)).order("log_date"),
    supabase.from("food_logs").select("eaten_at, items, calories, protein_g, fiber_g").eq("client_id", clientId)
      .gte("eaten_at", addDays(start, -1) + "T00:00:00Z").lte("eaten_at", addDays(end, 2) + "T00:00:00Z").order("eaten_at"),
    supabase.from("nutrition_targets").select("maintenance_calories, calorie_target, protein_g").eq("client_id", clientId).maybeSingle(),
    supabase.from("trajectory_weeks").select("phase, checkin_type, is_diet_break, moments").eq("week_number", Math.min(Math.max(week, 1), 52)).maybeSingle(),
    supabase.from("assessments").select("ai_summary, answers").eq("client_id", clientId).maybeSingle(),
    supabase.from("checkins").select("week_number, sleep, energy, stress, hunger, checkin_replies(final_text, sent_at)")
      .eq("client_id", clientId).lt("week_number", week).order("week_number", { ascending: false }).limit(3),
    loadProgram(supabase, clientId),
  ]);

  const days: DayFood[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(start, i);
    const rows = (food ?? []).filter((f) => todayIn(tz, new Date(f.eaten_at)) === date);
    days.push({
      date, meals: rows.length,
      calories: rows.reduce((s, r) => s + (r.calories ?? 0), 0),
      protein: Math.round(rows.reduce((s, r) => s + Number(r.protein_g ?? 0), 0)),
      fiber: Math.round(rows.reduce((s, r) => s + Number(r.fiber_g ?? 0), 0)),
      items: rows.flatMap((r) => ((r.items as { name: string; amount: string }[]) ?? []).map((i) => `${i.amount} ${i.name}`.trim())),
      list: rows.map((r) => ({
        calories: r.calories ?? 0, protein: Math.round(Number(r.protein_g ?? 0)),
        items: ((r.items as { name: string; amount: string }[]) ?? []).map((i) => `${i.amount} ${i.name}`.trim()),
      })),
    });
  }

  // Habits this week: daily habits in her open rings, how many of the 7 days she checked off.
  const focus = state.circles.filter((c) => c.focus).map((c) => c.name);
  const openRings = state.circles.flatMap((c) => c.rings.filter((r) => r.status === "open").map((r) => ({ circle: c.name, ring: r })));
  const habits = openRings.flatMap(({ circle, ring }) => ring.items
    .filter((i) => ["do", "eat", "take"].includes(i.type) && i.cadence === "daily")
    .map((i) => ({ circle, ring: ring.name, title: i.title, streak: i.progress, complete: i.complete })));

  const lastWeight = weights?.length ? weights[weights.length - 1] : null;
  const weekWeights = (weights ?? []).filter((w) => w.log_date >= start && w.log_date <= end);
  return {
    profile: p, week, start, end, phase: tw?.phase ?? null, checkinType: tw?.checkin_type ?? null, dietBreak: !!tw?.is_diet_break,
    moments: tw?.moments ?? [], weights: weights ?? [], weekWeights, lastWeight, days, target,
    focus, openRings: openRings.map((o) => `${o.circle} · Medal ${o.ring.number} ${o.ring.name} (day ${o.ring.day})`), habits,
    assessment, previous: prev ?? [],
  };
}
export type WeekData = Awaited<ReturnType<typeof weekData>>;
