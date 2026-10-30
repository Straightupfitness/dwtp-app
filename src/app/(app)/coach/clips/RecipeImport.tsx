"use client";
import { useState } from "react";
import { importRecipes, syncRecipeMedia, type RecipeRow } from "./actions";

type Raw = {
  id: number; mine: boolean; order: number; name: string; types: string[]; tags: string[]; description: string | null;
  prep: number | null; cook: number | null; servings: number; kcal: number | null; protein: number | null; carbs: number | null; fat: number | null;
  fiber: number | null; potassium: number | null; ingredients: { name: string; amount: number | null; unit: string }[]; steps: string[];
  photo: string | null; video: string | null;
};
const r1 = (n: number | null) => (n === null || n === undefined ? null : Math.round(n * 10) / 10);

/** Pick "dwtp-trainerize-recipes.json" (in Downloads) and import every recipe into the app. */
export default function RecipeImport() {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(file: File) {
    setBusy(true); setMsg("Reading…");
    try {
      const raw = JSON.parse(await file.text()) as Raw[];
      const rows: RecipeRow[] = raw.map((x) => ({
        id: x.id, name: x.name, mine: x.mine, sort: x.order, meal_types: x.types ?? [], tags: x.tags ?? [], description: x.description,
        prep_min: x.prep, cook_min: x.cook, servings: x.servings || 1,
        calories: r1(x.kcal), protein_g: r1(x.protein), carbs_g: r1(x.carbs), fat_g: r1(x.fat), fiber_g: r1(x.fiber), potassium_mg: x.potassium === null ? null : Math.round(x.potassium),
        ingredients: (x.ingredients ?? []).map((i) => ({ name: i.name, amount: i.amount, unit: i.unit })), steps: x.steps ?? [],
        has_photo: !!x.photo, has_video: false, // switched on per recipe once its video is uploaded (Re-check)
      }));
      for (let i = 0; i < rows.length; i += 200) {
        const r = await importRecipes(rows.slice(i, i + 200));
        if (r?.error) throw new Error(r.error);
        setMsg(`Imported ${Math.min(i + 200, rows.length)} of ${rows.length}…`);
      }
      const s = await syncRecipeMedia();
      setMsg(`Done: ${rows.length} recipes are in the app.${s && "videos" in s ? ` ${s.photos} photos and ${s.videos} videos found.` : ""}`);
    } catch (e) { setMsg(`Stopped: ${(e as Error).message}`); }
    setBusy(false);
  }
  return (
    <div className="space-y-2">
      <label className="flex min-h-[80px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[16px] border-2 border-dashed border-[#3a3a3a] bg-card p-4 text-center">
        <span className="text-[15px] font-semibold">Import recipes: choose &ldquo;dwtp-trainerize-recipes.json&rdquo;</span>
        <span className="text-[13px] text-dim">In Downloads. Safe to import again.</span>
        <input type="file" accept="application/json,.json" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) run(f); e.target.value = ""; }} />
      </label>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
