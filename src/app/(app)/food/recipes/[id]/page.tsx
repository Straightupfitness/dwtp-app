import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import { amountFor, cleanName, recipePhoto, recipeVideo, TAGS, TYPES, type Recipe } from "@/lib/recipes";
import LogRecipe from "./LogRecipe";

const display = "font-[family-name:var(--font-display)] uppercase";

/** One recipe: video or photo, numbers per serving, ingredients for one serving, steps, and Log it. */
export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("recipes").select("*").eq("id", Number(id)).maybeSingle();
  if (!data) notFound();
  const r = data as Recipe;
  const photo = recipePhoto(r), video = recipeVideo(r);
  const per = 1 / (Number(r.servings) || 1); // ingredients are for the whole recipe; show one serving
  const stat = (v: number | null, unit: string, label: string) => (
    <div className="text-center"><p className={`${display} text-[22px] leading-none`}>{v === null ? "–" : Math.round(v).toLocaleString()}<span className="ml-0.5 text-[12px] normal-case text-dim">{unit}</span></p><p className="mt-1 text-[11px] text-dim">{label}</p></div>
  );
  return (
    <section className="space-y-4">
      <BackButton fallback="/food/recipes" />
      {video
        ? <video src={video} poster={photo ?? undefined} controls playsInline preload="metadata" className="aspect-video w-full rounded-[18px] bg-black object-cover" />
        // eslint-disable-next-line @next/next/no-img-element -- storage photo
        : photo ? <img src={photo} alt="" className="aspect-[4/3] w-full rounded-[18px] object-cover" /> : null}
      <header className="space-y-1.5">
        {r.mine && <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-accent">Michael&apos;s recipe</p>}
        <h1 className={`${display} text-[28px] font-semibold leading-tight`}>{cleanName(r.name)}</h1>
        <p className="text-[13px] text-[#a8a8a8]">
          {[r.prep_min ? `Prep ${r.prep_min} min` : null, r.cook_min ? `Cook ${r.cook_min} min` : null, Number(r.servings) > 1 ? `Makes ${r.servings} servings` : null].filter(Boolean).join(" · ")}
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {r.meal_types.map((t) => <span key={t} className="rounded-full border border-[#2f2f2f] px-2.5 py-0.5 text-[12px] text-[#cfcfcf]">{TYPES[t] ?? t}</span>)}
          {r.tags.map((t) => <span key={t} className="rounded-full border border-[#2f2f2f] px-2.5 py-0.5 text-[12px] text-[#cfcfcf]">{TAGS[t] ?? t}</span>)}
        </div>
      </header>

      <div className="grid grid-cols-4 gap-2 rounded-[18px] border border-border bg-card p-3">
        {stat(r.calories, "", "kcal")}{stat(r.protein_g, "g", "protein")}{stat(r.fiber_g, "g", "fiber")}{stat(r.potassium_mg, "mg", "potassium")}
        <p className="col-span-4 text-center text-[11px] text-dim">Per serving{r.carbs_g !== null ? ` · ${Math.round(r.carbs_g)} g carbs · ${Math.round(r.fat_g ?? 0)} g fat` : ""}</p>
      </div>

      <LogRecipe id={r.id} kcal={Number(r.calories ?? 0)} protein={Number(r.protein_g ?? 0)} />

      {r.description && <p className="text-[15px] leading-relaxed text-[#d4d4d4]">{r.description}</p>}

      <div className="space-y-2">
        <h2 className={`${display} text-lg`}>Ingredients <span className="text-[13px] normal-case text-dim">for 1 serving</span></h2>
        <ul className="divide-y divide-border rounded-[18px] border border-border bg-card">
          {r.ingredients.map((i, n) => (
            <li key={n} className="flex justify-between gap-3 px-3.5 py-2.5 text-[14px]"><span>{i.name}</span><span className="shrink-0 text-right text-[#a8a8a8]">{amountFor(i.amount, i.unit, per)}</span></li>
          ))}
        </ul>
        {Number(r.servings) > 1 && <p className="text-[12px] text-dim">The whole recipe makes {r.servings} servings: multiply by {r.servings} to cook it all.</p>}
      </div>

      {r.steps.length > 0 && (
        <div className="space-y-2">
          <h2 className={`${display} text-lg`}>How to make it</h2>
          <ol className="space-y-2.5">
            {r.steps.map((s, n) => (
              <li key={n} className="flex gap-3 rounded-[14px] border border-border bg-card p-3 text-[15px] leading-relaxed">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-bold text-black">{n + 1}</span><span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
