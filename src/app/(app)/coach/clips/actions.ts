"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type RecipeRow = {
  id: number; name: string; mine: boolean; sort: number; meal_types: string[]; tags: string[]; description: string | null;
  prep_min: number | null; cook_min: number | null; servings: number;
  calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null; fiber_g: number | null; potassium_mg: number | null;
  ingredients: { name: string; amount: number | null; unit: string }[]; steps: string[]; has_photo: boolean; has_video: boolean;
};

/** Michael imports the recipes file from Trainerize (October 29), a batch at a time. Safe to run again. */
export async function importRecipes(rows: RecipeRow[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").single();
  if (me?.role !== "coach") return { error: "Coach only" };
  if (!Array.isArray(rows) || rows.length > 500) return { error: "Bad batch" };
  const { error } = await supabase.from("recipes").upsert(rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })), { onConflict: "id" });
  if (error) return { error: error.message };
  revalidatePath("/food/recipes");
  return { ok: true, n: rows.length };
}
