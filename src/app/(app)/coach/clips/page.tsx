import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Uploader from "./Uploader";
import RecipeImport from "./RecipeImport";
import SyncMedia from "./SyncMedia";

export default async function ClipsPage() {
  const supabase = await createClient();
  const [{ count: clips }, { data: stored }] = await Promise.all([
    supabase.from("exercises").select("id", { count: "exact", head: true }).not("clip_path", "is", null),
    supabase.storage.from("exercise-clips").list("sltp", { limit: 2000 }),
  ]);
  let recipeFiles = 0;
  for (let off = 0; off < 20000; off += 1000) {
    const { data: rec } = await supabase.storage.from("exercise-clips").list("recipes", { limit: 1000, offset: off });
    recipeFiles += (rec ?? []).length;
    if ((rec ?? []).length < 1000) break;
  }
  const { count: recipeCount } = await supabase.from("recipes").select("id", { count: "exact", head: true });
  const have = (stored ?? []).filter((f) => f.name.endsWith(".mp4")).length;
  return (
    <section className="space-y-4">
      <Link href="/coach" className="inline-flex min-h-11 items-center text-sm text-dim">← Clients</Link>
      <header>
        <p className="text-xs uppercase tracking-[0.15em] text-accent">Coach</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl uppercase">Clips &amp; recipe media</h1>
        <p className="mt-1 text-sm text-dim">{have} of {clips ?? 0} clips are in the app. Upload the folder once; uploading again replaces the same files.</p>
      </header>
      <Uploader />

      {/* Recipes from Trainerize (October 29): their photos and Michael's recipe videos. */}
      <div className="space-y-2 pt-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl uppercase">Recipe photos &amp; videos</h2>
        <p className="text-sm text-dim">{recipeCount ?? 0} recipes and {recipeFiles} recipe photos/videos are in the app.</p>
        <RecipeImport />
        <SyncMedia />
        <Uploader prefix="recipes" folder="DWTP Recipe Media" what="recipes" />
      </div>
      <Link href="/workouts" className="inline-flex min-h-11 items-center text-sm text-accent">See the workouts as a client sees them →</Link>
    </section>
  );
}
