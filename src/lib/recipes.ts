/** Recipes from Trainerize (October 29). Photos and Michael's videos live in exercise-clips/recipes/<id>.jpg|.mp4. */
import { supabaseUrl } from "./supabase/config";

export type Recipe = {
  id: number; name: string; mine: boolean; meal_types: string[]; tags: string[]; description: string | null;
  prep_min: number | null; cook_min: number | null; servings: number;
  calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null; fiber_g: number | null; potassium_mg: number | null;
  ingredients: { name: string; amount: number | null; unit: string }[]; steps: string[]; has_photo: boolean; has_video: boolean;
};

const base = () => `${supabaseUrl()}/storage/v1/object/public/exercise-clips/recipes`;
export const recipePhoto = (r: Pick<Recipe, "id" | "has_photo">) => (r.has_photo ? `${base()}/${r.id}.jpg` : null);
export const recipeVideo = (r: Pick<Recipe, "id" | "has_video">) => (r.has_video ? `${base()}/${r.id}.mp4` : null);

/** "Seared Bison with Sweet Potato Wedges (800 Calories DRIVEN)" → "Seared Bison with Sweet Potato Wedges". */
export const cleanName = (n: string) => n.replace(/\s*\((\d+)\s*calories?[^)]*\)\s*$/i, "").trim();

export const TAGS: Record<string, string> = {
  simpleMeals: "Simple", highFiber: "High fiber", noCooking: "No cooking", onePot: "One pot", paleo: "Paleo", salad: "Salad",
  smoothie: "Smoothie", instantPot: "Instant Pot", soup: "Soup", pork: "Pork", slowCooker: "Slow cooker",
};
export const TYPES: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snacks: "Snacks" };

/** "1.5" → "1½"; ingredients for n servings. */
export function amountFor(amount: number | null, unit: string, k: number) {
  if (amount === null) return unit;
  const v = Math.round(amount * k * 100) / 100;
  const frac: Record<string, string> = { "0.25": "¼", "0.5": "½", "0.75": "¾", "0.33": "⅓", "0.67": "⅔" };
  const whole = Math.floor(v), rest = Math.round((v - whole) * 100) / 100;
  const txt = rest && frac[String(rest)] ? `${whole || ""}${frac[String(rest)]}` : String(v);
  return `${txt} ${unit}`.trim();
}
