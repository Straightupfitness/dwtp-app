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

/**
 * After recipe photos/videos are uploaded: mark each recipe's photo and video as there (or not) from what's
 * actually in storage, so a recipe never shows a video that isn't uploaded yet.
 */
export async function syncRecipeMedia() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").single();
  if (me?.role !== "coach") return { error: "Coach only" };
  const mp4 = new Set<number>(), jpg = new Set<number>();
  for (let off = 0; off < 50000; off += 1000) {
    const { data, error } = await supabase.storage.from("exercise-clips").list("recipes", { limit: 1000, offset: off });
    if (error) return { error: error.message };
    for (const f of data ?? []) { const m = f.name.match(/^(\d+)\.(mp4|jpg)$/); if (m) (m[2] === "mp4" ? mp4 : jpg).add(Number(m[1])); }
    if ((data ?? []).length < 1000) break;
  }
  const { data: all } = await supabase.from("recipes").select("id, has_photo, has_video").limit(10000);
  const changes = (all ?? []).filter((r) => r.has_video !== mp4.has(r.id) || r.has_photo !== jpg.has(r.id));
  const groups = new Map<string, number[]>();
  for (const r of changes) { const k = `${jpg.has(r.id)}|${mp4.has(r.id)}`; groups.set(k, [...(groups.get(k) ?? []), r.id]); }
  for (const [k, ids] of groups) {
    const [p, v] = k.split("|").map((x) => x === "true");
    for (let i = 0; i < ids.length; i += 150) {
      const { error } = await supabase.from("recipes").update({ has_photo: p, has_video: v }).in("id", ids.slice(i, i + 150));
      if (error) return { error: error.message };
    }
  }
  revalidatePath("/food/recipes", "layout");
  return { ok: true, photos: jpg.size, videos: mp4.size, changed: changes.length };
}
