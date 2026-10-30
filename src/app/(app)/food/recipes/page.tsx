import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import { cleanName, recipePhoto, TAGS, TYPES, type Recipe } from "@/lib/recipes";

const display = "font-[family-name:var(--font-display)] uppercase";
const PER = 30;

/**
 * Recipes (October 29): Michael's own first, then the library. Search, filter by meal or style, or show only
 * high-protein ones (40 g+ a serving, his rule). Tap one to see it and log it.
 */
export default async function RecipesPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; tag?: string; who?: string; p?: string; protein?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const page = Math.max(0, Number(sp.p) || 0);
  let q = supabase.from("recipes").select("id, name, mine, calories, protein_g, has_photo, has_video, prep_min, cook_min", { count: "exact" }).eq("active", true);
  if (sp.q?.trim()) q = q.ilike("name", `%${sp.q.trim().replace(/[%_]/g, "")}%`);
  if (sp.type && TYPES[sp.type]) q = q.contains("meal_types", [sp.type]);
  if (sp.tag && TAGS[sp.tag]) q = q.contains("tags", [sp.tag]);
  if (sp.who === "michael") q = q.eq("mine", true);
  if (sp.protein === "40") q = q.gte("protein_g", 40);
  const { data, count } = await q.order("mine", { ascending: false }).order("sort").range(page * PER, page * PER + PER - 1);
  const rows = (data ?? []) as Pick<Recipe, "id" | "name" | "mine" | "calories" | "protein_g" | "has_photo" | "has_video" | "prep_min" | "cook_min">[];
  const link = (patch: Record<string, string | undefined>) => {
    const u = new URLSearchParams(Object.entries({ ...sp, p: undefined, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/food/recipes${u.toString() ? `?${u}` : ""}`;
  };
  const chip = (on: boolean) => `shrink-0 rounded-full border px-3 py-1.5 text-[13px] ${on ? "border-accent bg-accent font-semibold text-black" : "border-[#2f2f2f] text-[#cfcfcf]"}`;

  return (
    <section className="space-y-3.5">
      <BackButton fallback="/food" />
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Pick, cook, log</p>
        <h1 className={`${display} mt-1 text-[30px] font-semibold`}>Recipes</h1>
      </header>
      <form action="/food/recipes" className="flex gap-2">
        {Object.entries(sp).filter(([k, v]) => v && k !== "q" && k !== "p").map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Search recipes, e.g. bison, waffles" aria-label="Search recipes"
          className="min-h-11 flex-1 rounded-xl border border-[#2a2a2a] bg-card px-4 text-[15px] outline-none focus:border-accent" />
        <button className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-black">Search</button>
      </form>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        <Link href={link({ who: sp.who === "michael" ? undefined : "michael" })} className={chip(sp.who === "michael")}>★ Michael&apos;s</Link>
        <Link href={link({ protein: sp.protein === "40" ? undefined : "40" })} className={chip(sp.protein === "40")}>40 g+ protein</Link>
        {Object.entries(TYPES).map(([k, l]) => <Link key={k} href={link({ type: sp.type === k ? undefined : k })} className={chip(sp.type === k)}>{l}</Link>)}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {Object.entries(TAGS).map(([k, l]) => <Link key={k} href={link({ tag: sp.tag === k ? undefined : k })} className={chip(sp.tag === k)}>{l}</Link>)}
      </div>
      <p className="text-[13px] text-dim">{(count ?? 0).toLocaleString()} recipes</p>

      <div className="grid grid-cols-2 gap-2.5">
        {rows.map((r) => {
          const photo = recipePhoto(r);
          return (
            <Link key={r.id} href={`/food/recipes/${r.id}`} className="overflow-hidden rounded-[16px] border border-border bg-card">
              <span className="relative block aspect-[4/3] bg-[#1b1b1b]">
                {/* eslint-disable-next-line @next/next/no-img-element -- storage photo */}
                {photo && <img src={photo} alt="" loading="lazy" className="size-full object-cover" />}
                {r.mine && <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-black">Michael&apos;s</span>}
                {r.has_video && <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/70 text-accent" aria-label="Has a video">▶</span>}
              </span>
              <span className="block space-y-1 px-2.5 py-2">
                <span className="line-clamp-2 block text-[14px] font-semibold leading-snug">{cleanName(r.name)}</span>
                <span className="block text-[12px] text-dim">{Math.round(Number(r.calories ?? 0))} kcal · {Math.round(Number(r.protein_g ?? 0))} g protein</span>
              </span>
            </Link>
          );
        })}
      </div>
      {!rows.length && <p className="rounded-2xl border border-dashed border-[#2f2f2f] p-6 text-center text-dim">No recipes match. Try fewer filters.</p>}
      <nav className="flex gap-2">
        {page > 0 && <Link href={link({ p: String(page - 1) })} className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-border text-sm">← Previous</Link>}
        {(count ?? 0) > (page + 1) * PER && <Link href={link({ p: String(page + 1) })} className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-border text-sm">More recipes →</Link>}
      </nav>
    </section>
  );
}
