import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/program";
import { DAILY_TARGETS, type FoodItem } from "@/lib/food";
import AddMeal from "./AddMeal";
import DeleteMeal from "./DeleteMeal";

/** Start of the window we fetch: 36 hours back covers "today" in any US time zone. */
function windowStart() {
  return new Date(Date.now() - 36 * 3600_000).toISOString();
}

const SLOT_LABEL: Record<string, string> = { meal_1: "Meal 1", meal_2: "Meal 2", meal_3: "Meal 3", other: "Other" };

function Bar({ label, value, target, unit }: { label: string; value: number; target: number; unit: string }) {
  const pct = Math.min(100, Math.round((value / target) * 100));
  return (
    <div>
      <div className="flex justify-between text-sm"><span>{label}</span><span className="text-dim">{Math.round(value)} / {target} {unit}</span></div>
      <div className="mt-1 h-2 rounded-full bg-border"><div className="h-2 rounded-full bg-accent" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export default async function FoodPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("timezone").eq("id", user!.id).single();
  const tz = profile?.timezone ?? "America/Los_Angeles";
  const today = todayIn(tz);

  // Her day in her time zone: fetch the last ~36 hours and keep today's.
  const { data: rows } = await supabase.from("food_logs")
    .select("id, eaten_at, meal_slot, items, calories, protein_g, fiber_g, potassium_mg, photo_path")
    .eq("client_id", user!.id).gte("eaten_at", windowStart()).order("eaten_at");
  const meals = (rows ?? []).filter((r) => todayIn(tz, new Date(r.eaten_at)) === today);
  const { data: target } = await supabase.from("nutrition_targets").select("calorie_target, protein_g").eq("client_id", user!.id).maybeSingle();

  const sum = meals.reduce((t, m) => ({
    calories: t.calories + (m.calories ?? 0), protein: t.protein + Number(m.protein_g ?? 0),
    fiber: t.fiber + Number(m.fiber_g ?? 0), potassium: t.potassium + (m.potassium_mg ?? 0),
  }), { calories: 0, protein: 0, fiber: 0, potassium: 0 });

  const photoUrls = new Map<string, string>();
  const paths = meals.map((m) => m.photo_path).filter(Boolean) as string[];
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("food-photos").createSignedUrls(paths, 3600);
    signed?.forEach((s) => s.path && s.signedUrl && photoUrls.set(s.path, s.signedUrl));
  }
  const used = new Set(meals.map((m) => m.meal_slot));
  const nextSlot = (["meal_1", "meal_2", "meal_3"] as const).find((s) => !used.has(s)) ?? "other";

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm uppercase tracking-widest text-accent">Food Philosophy</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl uppercase">Today&apos;s food</h1>
      </header>

      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        {target?.calorie_target
          ? <Bar label="Calories" value={sum.calories} target={target.calorie_target} unit="kcal" />
          : <p className="text-sm"><b>{Math.round(sum.calories)}</b> kcal so far · <span className="text-dim">Michael sets your calorie target after 14 days of logging.</span></p>}
        <Bar label="Protein" value={sum.protein} target={target?.protein_g ?? DAILY_TARGETS.protein_g} unit="g" />
        <Bar label="Fiber" value={sum.fiber} target={DAILY_TARGETS.fiber_g} unit="g" />
        <Bar label="Potassium" value={sum.potassium} target={DAILY_TARGETS.potassium_mg} unit="mg" />
      </div>

      <AddMeal userId={user!.id} defaultSlot={nextSlot} />

      <div className="space-y-3">
        {meals.map((m) => (
          <article key={m.id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
            {m.photo_path && photoUrls.get(m.photo_path) && (
              // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL
              <img src={photoUrls.get(m.photo_path)} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
            )}
            <div className="flex-1">
              <p className="text-xs uppercase tracking-widest text-accent">{SLOT_LABEL[m.meal_slot ?? "other"]}</p>
              <p className="text-sm">{(m.items as FoodItem[]).map((i) => i.name).join(", ")}</p>
              <p className="text-xs text-dim">{m.calories} kcal · {m.protein_g} g protein · {m.fiber_g} g fiber</p>
            </div>
            <DeleteMeal id={m.id} />
          </article>
        ))}
        {!meals.length && <p className="text-dim">Nothing logged yet today. Eat whatever you want, just log it.</p>}
      </div>
    </section>
  );
}
