"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { totals, type FoodItem } from "@/lib/food";
import { todayIn } from "@/lib/program";
import { awardAutoHabit, closeOutRings } from "@/lib/progress";

export async function saveMeal(input: {
  items: FoodItem[];
  mealSlot: "meal_1" | "meal_2" | "meal_3" | "other";
  source: "photo" | "voice" | "text";
  description: string;
  photoPath: string | null;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const items = input.items.filter((i) => i.name.trim());
  const t = totals(items);
  const { error } = await supabase.from("food_logs").insert({
    client_id: user.id,
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
  const { data: profile } = await supabase.from("profiles").select("timezone").eq("id", user.id).single();
  await awardAutoHabit(supabase, user.id, "log-food", todayIn(profile?.timezone ?? "America/Los_Angeles"));
  await closeOutRings(supabase, user.id);
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
