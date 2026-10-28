"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { totals, type FoodItem } from "@/lib/food";
import { todayIn } from "@/lib/program";
import { awardAutoHabit, closeOutRings } from "@/lib/progress";

export async function saveMeal(input: {
  items: FoodItem[];
  mealSlot: "meal_1" | "meal_2" | "meal_3" | "other";
  source: "photo" | "voice" | "text" | "saved_meal";
  description: string;
  photoPath: string | null;
  savedMealId?: string | null;
  saveAs?: string | null;  // also save this meal as a go-to meal with this name
  eatenAt?: string | null; // when she ate it, if not now (last 7 days only)
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const items = input.items.filter((i) => i.name.trim());
  const t = totals(items);
  const at = input.eatenAt ? new Date(input.eatenAt) : null;
  const eatenAt = at && !isNaN(at.getTime()) && at.getTime() <= Date.now() + 60_000 && Date.now() - at.getTime() <= 8 * 86_400_000 ? at.toISOString() : undefined;
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
  const eatenAt = at && !isNaN(at.getTime()) && at.getTime() <= Date.now() + 60_000 && Date.now() - at.getTime() <= 8 * 86_400_000 ? at.toISOString() : undefined;
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

/** Save a go-to meal (her Favorite Three, Backup Three…) to log again with one tap. */
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
