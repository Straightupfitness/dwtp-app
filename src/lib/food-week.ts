import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { todayIn } from "./program";
import { addDays } from "./daily";
import { DAILY_TARGETS, type FoodItem } from "./food";

export type WeekMeal = {
  id: string; time: string; slot: string; source: string | null; description: string | null; items: FoodItem[];
  kcal: number; protein: number; fiber: number; potassium: number; photo: string | null;
};
export type FoodDay = { date: string; meals: WeekMeal[]; kcal: number; protein: number; fiber: number; potassium: number };
export type FoodWeekData = {
  days: FoodDay[]; today: string;
  targets: { kcal: number | null; protein: number; fiber: number; potassium: number };
};

const SLOT: Record<string, string> = { meal_1: "Meal 1", meal_2: "Meal 2", meal_3: "Meal 3", other: "Other" };

/**
 * Her food, day by day, for Michael (November 1): `count` days ending on `end` (default today in her time zone),
 * oldest first, each meal with its foods, numbers and photo.
 */
export async function loadFoodWeek(supabase: SupabaseClient, clientId: string, opts: { count?: number; end?: string } = {}): Promise<FoodWeekData> {
  const count = opts.count ?? 7;
  const { data: p } = await supabase.from("profiles").select("timezone").eq("id", clientId).single();
  const tz = p?.timezone ?? "America/Los_Angeles";
  const today = todayIn(tz);
  const end = opts.end && opts.end < today ? opts.end : today;
  const first = addDays(end, -(count - 1));
  const [{ data: rows }, { data: t }] = await Promise.all([
    supabase.from("food_logs").select("id, eaten_at, meal_slot, source, description, items, calories, protein_g, fiber_g, potassium_mg, photo_path")
      .eq("client_id", clientId).gte("eaten_at", addDays(first, -1) + "T00:00:00Z").lt("eaten_at", addDays(end, 2) + "T00:00:00Z").order("eaten_at"),
    supabase.from("nutrition_targets").select("calorie_target, protein_g, fiber_g, potassium_mg").eq("client_id", clientId).maybeSingle(),
  ]);
  const photos = new Map<string, string>();
  const paths = (rows ?? []).map((m) => m.photo_path).filter(Boolean) as string[];
  if (paths.length) {
    const { data } = await supabase.storage.from("food-photos").createSignedUrls(paths, 3600);
    data?.forEach((s) => s.path && s.signedUrl && photos.set(s.path, s.signedUrl));
  }
  const time = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  const days: FoodDay[] = Array.from({ length: count }, (_, i) => ({ date: addDays(first, i), meals: [], kcal: 0, protein: 0, fiber: 0, potassium: 0 }));
  const byDate = new Map(days.map((d) => [d.date, d]));
  for (const r of rows ?? []) {
    const d = byDate.get(todayIn(tz, new Date(r.eaten_at)));
    if (!d) continue;
    const m: WeekMeal = {
      id: r.id, time: time(r.eaten_at), slot: SLOT[r.meal_slot ?? "other"] ?? "Other", source: r.source, description: r.description,
      items: (r.items as FoodItem[] | null) ?? [], kcal: Math.round(r.calories ?? 0), protein: Math.round(Number(r.protein_g ?? 0)),
      fiber: Math.round(Number(r.fiber_g ?? 0)), potassium: Math.round(r.potassium_mg ?? 0), photo: r.photo_path ? photos.get(r.photo_path) ?? null : null,
    };
    d.meals.push(m);
    d.kcal += m.kcal; d.protein += m.protein; d.fiber += m.fiber; d.potassium += m.potassium;
  }
  return {
    days, today,
    targets: { kcal: t?.calorie_target ?? null, protein: t?.protein_g ?? DAILY_TARGETS.protein_g, fiber: t?.fiber_g ?? DAILY_TARGETS.fiber_g, potassium: t?.potassium_mg ?? DAILY_TARGETS.potassium_mg },
  };
}
