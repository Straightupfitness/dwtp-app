"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { totals, type FoodItem } from "@/lib/food";
import { todayIn } from "@/lib/program";
import { awardAutoHabit, closeOutRings } from "@/lib/progress";

/** She can log, edit and copy meals on any of the last 62 days (October 29: browse and fix previous days). */
const MAX_BACK_MS = 62 * 86_400_000;

export async function saveMeal(input: {
  items: FoodItem[];
  mealSlot: "meal_1" | "meal_2" | "meal_3" | "other";
  source: "photo" | "voice" | "text" | "saved_meal";
  description: string;
  photoPath: string | null;
  savedMealId?: string | null;
  saveAs?: string | null;  // also save this meal as a go-to meal with this name
  eatenAt?: string | null; // when she ate it, if not now (last 62 days)
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const items = input.items.filter((i) => i.name.trim());
  const t = totals(items);
  const at = input.eatenAt ? new Date(input.eatenAt) : null;
  const eatenAt = at && !isNaN(at.getTime()) && at.getTime() <= Date.now() + 60_000 && Date.now() - at.getTime() <= MAX_BACK_MS ? at.toISOString() : undefined;
  const { error } = await supabase.from("food_logs").insert({
    client_id: user.id,
    ...(eatenAt ? { eaten_at: eatenAt } : {}),
    meal_slot: input.mealSlot,
    source: input.source,
    description: input.description || null,
    photo_path: input.photoPath,
    items,
    calories: Math.round(t.calories),
    protein_g: Math.round(t.protein_g * 10) / 10,
    fiber_g: Math.round(t.fiber_g * 10) / 10,
    potassium_mg: Math.round(t.potassium_mg),
    confirmed: true,
  });
  if (error) return { error: error.message };
  if (input.savedMealId) await supabase.from("saved_meals").update({ last_used_at: new Date().toISOString() }).eq("id", input.savedMealId).eq("client_id", user.id);
  if (input.saveAs?.trim()) await saveGoTo(input.saveAs, items);
  const { data: profile } = await supabase.from("profiles").select("timezone").eq("id", user.id).single();
  // Credit "log every meal" on the day she ate it (a lunch logged that evening, or yesterday's dinner).
  await awardAutoHabit(supabase, user.id, "log-food", todayIn(profile?.timezone ?? "America/Los_Angeles", eatenAt ? new Date(eatenAt) : new Date()));
  await closeOutRings(supabase, user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Change a meal she already saved: its foods, which meal it was, and when she ate it. The photo stays. */
export async function updateMeal(id: string, input: { items: FoodItem[]; mealSlot: "meal_1" | "meal_2" | "meal_3" | "other"; eatenAt?: string | null; saveAs?: string | null }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const items = input.items.filter((i) => i.name.trim());
  if (!items.length) return { error: "Add at least one food, or delete the meal instead." };
  const t = totals(items);
  const at = input.eatenAt ? new Date(input.eatenAt) : null;
  const eatenAt = at && !isNaN(at.getTime()) && at.getTime() <= Date.now() + 60_000 && Date.now() - at.getTime() <= MAX_BACK_MS ? at.toISOString() : undefined;
  const { error } = await supabase.from("food_logs").update({
    ...(eatenAt ? { eaten_at: eatenAt } : {}),
    meal_slot: input.mealSlot,
    items,
    calories: Math.round(t.calories),
    protein_g: Math.round(t.protein_g * 10) / 10,
    fiber_g: Math.round(t.fiber_g * 10) / 10,
    potassium_mg: Math.round(t.potassium_mg),
  }).eq("id", id).eq("client_id", user.id);
  if (error) return { error: error.message };
  if (input.saveAs?.trim()) await saveGoTo(input.saveAs, items);
  if (eatenAt) {
    const { data: profile } = await supabase.from("profiles").select("timezone").eq("id", user.id).single();
    await awardAutoHabit(supabase, user.id, "log-food", todayIn(profile?.timezone ?? "America/Los_Angeles", new Date(eatenAt)));
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteMeal(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data } = await supabase.from("food_logs").select("photo_path").eq("id", id).eq("client_id", user.id).maybeSingle();
  if (data?.photo_path) await supabase.storage.from("food-photos").remove([data.photo_path]);
  await supabase.from("food_logs").delete().eq("id", id).eq("client_id", user.id);
  revalidatePath("/food");
}

/** Save a favorite meal (her Favorite Three, Backup Three, a daily breakfast…) to log again with one tap. */
export async function saveGoTo(name: string, items: FoodItem[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !name.trim()) return;
  const t = totals(items);
  await supabase.from("saved_meals").insert({
    client_id: user.id, name: name.trim().slice(0, 60), kind: "favorite", items,
    calories: Math.round(t.calories), protein_g: Math.round(t.protein_g * 10) / 10, fiber_g: Math.round(t.fiber_g * 10) / 10,
    potassium_mg: Math.round(t.potassium_mg), last_used_at: new Date().toISOString(),
  });
  revalidatePath("/food");
}

export async function deleteGoTo(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("saved_meals").delete().eq("id", id).eq("client_id", user.id);
  revalidatePath("/food");
}

/**
 * Copy a meal she logged onto another day (October 29: "copy meals from the previous day"), at the same time of day.
 * The copy has no photo, so deleting one never takes the other's picture with it.
 */
export async function copyMeal(id: string, toDay: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !/^\d{4}-\d{2}-\d{2}$/.test(toDay)) return { error: "Not signed in" };
  const { data: m } = await supabase.from("food_logs").select("eaten_at, meal_slot, source, description, items, calories, protein_g, fiber_g, potassium_mg")
    .eq("id", id).eq("client_id", user.id).maybeSingle();
  if (!m) return { error: "Meal not found" };
  const { data: profile } = await supabase.from("profiles").select("timezone").eq("id", user.id).single();
  const tz = profile?.timezone ?? "America/Los_Angeles";
  const fromDay = todayIn(tz, new Date(m.eaten_at));
  const shift = Math.round((Date.parse(toDay) - Date.parse(fromDay)) / 86_400_000);
  let at = new Date(new Date(m.eaten_at).getTime() + shift * 86_400_000);
  if (at.getTime() > Date.now()) at = new Date();
  if (Date.now() - at.getTime() > MAX_BACK_MS) return { error: "That day is too far back." };
  const { error } = await supabase.from("food_logs").insert({
    client_id: user.id, eaten_at: at.toISOString(), meal_slot: m.meal_slot, source: m.source === "photo" ? "text" : m.source,
    description: m.description, photo_path: null, items: m.items, calories: m.calories, protein_g: m.protein_g, fiber_g: m.fiber_g,
    potassium_mg: m.potassium_mg, confirmed: true,
  });
  if (error) return { error: error.message };
  await awardAutoHabit(supabase, user.id, "log-food", todayIn(tz, at));
  await closeOutRings(supabase, user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Star a meal she already logged as a favorite, to log it again with one tap. */
export async function favoriteMeal(id: string, name: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !name.trim()) return { error: "Give it a name" };
  const { data: m } = await supabase.from("food_logs").select("items").eq("id", id).eq("client_id", user.id).maybeSingle();
  if (!m) return { error: "Meal not found" };
  await saveGoTo(name, m.items as FoodItem[]);
  return { ok: true };
}
