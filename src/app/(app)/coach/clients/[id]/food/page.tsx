import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/program";
import { addDays } from "@/lib/daily";
import type { FoodItem } from "@/lib/food";

const display = "font-[family-name:var(--font-display)] uppercase";
const SLOT: Record<string, string> = { meal_1: "Meal 1", meal_2: "Meal 2", meal_3: "Meal 3", other: "Other" };

/** Michael checks a client's food log (October 29): any day, every meal with its photo, foods and numbers. */
export default async function ClientFood({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ d?: string }> }) {
  const { id } = await params;
  const asked = (await searchParams).d;
  const supabase = await createClient();
  const { data: p } = await supabase.from("profiles").select("full_name, timezone").eq("id", id).single();
  if (!p) notFound();
  const tz = p.timezone ?? "America/Los_Angeles";
  const today = todayIn(tz);
  const day = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= today ? asked : today;
  const [{ data: rows }, { data: t }] = await Promise.all([
    supabase.from("food_logs").select("id, eaten_at, meal_slot, source, description, items, calories, protein_g, fiber_g, potassium_mg, photo_path")
      .eq("client_id", id).gte("eaten_at", addDays(day, -2) + "T00:00:00Z").lt("eaten_at", addDays(day, 2) + "T00:00:00Z").order("eaten_at"),
    supabase.from("nutrition_targets").select("calorie_target, protein_g").eq("client_id", id).maybeSingle(),
  ]);
  const meals = (rows ?? []).filter((r) => todayIn(tz, new Date(r.eaten_at)) === day);
  const photos = new Map<string, string>();
  const paths = meals.map((m) => m.photo_path).filter(Boolean) as string[];
  if (paths.length) {
    const { data } = await supabase.storage.from("food-photos").createSignedUrls(paths, 3600);
    data?.forEach((s) => s.path && s.signedUrl && photos.set(s.path, s.signedUrl));
  }
  const sum = meals.reduce((a, m) => ({ kcal: a.kcal + (m.calories ?? 0), p: a.p + Number(m.protein_g ?? 0), f: a.f + Number(m.fiber_g ?? 0), k: a.k + (m.potassium_mg ?? 0) }), { kcal: 0, p: 0, f: 0, k: 0 });
  const time = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  const label = new Date(day + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
  const tiles: [string, string][] = [
    [String(Math.round(sum.kcal)), t?.calorie_target ? `of ${t.calorie_target} kcal` : "kcal"],
    [`${Math.round(sum.p)} g`, t?.protein_g ? `of ${t.protein_g} g protein` : "protein"],
    [`${Math.round(sum.f)} g`, "fiber"],
    [`${(sum.k / 1000).toFixed(1)}k`, "mg potassium"],
  ];

  return (
    <section className="space-y-4">
      <Link href={`/coach/clients/${id}`} className="inline-flex min-h-11 items-center text-sm text-dim">← {p.full_name}</Link>
      <header>
        <p className="text-xs uppercase tracking-[0.15em] text-accent">{p.full_name}&apos;s food log</p>
        <h1 className={`${display} text-3xl`}>{day === today ? "Today" : label}</h1>
      </header>
      <nav className="flex gap-2">
        <Link href={`?d=${addDays(day, -1)}`} className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-border text-sm">← Day before</Link>
        {day < today && <Link href={`?d=${addDays(day, 1)}`} className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-border text-sm">Next day →</Link>}
      </nav>
      <div className="grid grid-cols-4 gap-2 rounded-[18px] border border-border bg-card p-3 text-center">
        {tiles.map(([v, l]) => (
          <div key={l}><p className={`${display} text-xl leading-none`}>{v}</p><p className="mt-1 text-[11px] text-dim">{l}</p></div>
        ))}
      </div>
      {meals.map((m) => (
        <article key={m.id} className="space-y-2 rounded-[18px] border border-border bg-card p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[11px] uppercase tracking-[0.12em] text-accent">{SLOT[m.meal_slot ?? "other"]} · {time(m.eaten_at)} · {m.source}</p>
            <p className="shrink-0 text-[13px] font-semibold">{m.calories} kcal · {Math.round(Number(m.protein_g))} g P</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL */}
          {m.photo_path && photos.get(m.photo_path) && <img src={photos.get(m.photo_path)} alt="" className="max-h-64 w-full rounded-xl object-cover" />}
          {m.description && <p className="text-[13px] italic text-[#a8a8a8]">&ldquo;{m.description}&rdquo;</p>}
          <ul className="divide-y divide-border text-[14px]">
            {(m.items as FoodItem[]).map((it, i) => (
              <li key={i} className="flex justify-between gap-3 py-1.5"><span>{it.name} <span className="text-dim">· {it.amount}</span></span><span className="shrink-0 text-dim">{Math.round(it.calories)} kcal · {it.protein_g} g</span></li>
            ))}
          </ul>
        </article>
      ))}
      {!meals.length && <p className="rounded-2xl border border-dashed border-[#2f2f2f] p-6 text-center text-dim">Nothing logged this day.</p>}
    </section>
  );
}
