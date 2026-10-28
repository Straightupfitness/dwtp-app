import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/program";
import { DAILY_TARGETS, type FoodItem } from "@/lib/food";
import MealLogger, { type GoTo } from "./MealLogger";
import DeleteMeal from "./DeleteMeal";
import EditMeal from "./EditMeal";

const display = "font-[family-name:var(--font-display)] uppercase";
const SLOT_LABEL: Record<string, string> = { meal_1: "Meal 1", meal_2: "Meal 2", meal_3: "Meal 3", other: "Other" };
/** Start of the window we fetch: 36 hours back covers "today" in any US time zone. */
function windowStart() { return new Date(Date.now() - 36 * 3600_000).toISOString(); }

function Mini({ label, value, target, unit, fmt }: { label: string; value: number; target: number; unit: string; fmt?: (n: number) => string }) {
  const f = fmt ?? ((n: number) => String(Math.round(n)));
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] uppercase tracking-[0.08em] text-dim">{label}</p>
      <p className="text-[15px] font-semibold">{f(value)}<span className="font-normal text-dim"> / {f(target)} {unit}</span></p>
      <div className="h-1 rounded-full bg-[#262626]"><div className="h-1 rounded-full bg-gold" style={{ width: `${Math.min(100, Math.round((value / target) * 100))}%` }} /></div>
    </div>
  );
}

export default async function FoodPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("timezone").eq("id", user!.id).single();
  const tz = profile?.timezone ?? "America/Los_Angeles";
  const today = todayIn(tz);

  const [{ data: rows }, { data: target }, { data: saved }] = await Promise.all([
    supabase.from("food_logs").select("id, eaten_at, meal_slot, source, items, calories, protein_g, fiber_g, potassium_mg, photo_path")
      .eq("client_id", user!.id).gte("eaten_at", windowStart()).order("eaten_at"),
    supabase.from("nutrition_targets").select("calorie_target, protein_g").eq("client_id", user!.id).maybeSingle(),
    supabase.from("saved_meals").select("id, name, items, last_used_at").eq("client_id", user!.id).order("last_used_at", { ascending: false, nullsFirst: false }).limit(20),
  ]);
  const meals = (rows ?? []).filter((r) => todayIn(tz, new Date(r.eaten_at)) === today);
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
  const kcalTarget = target?.calorie_target ?? null;
  const time = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));

  return (
    <section className="space-y-3.5">
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">What are you eating?</p>
        <h1 className={`${display} mt-1 text-[30px] font-semibold`}>Today&apos;s food</h1>
      </header>

      <div className="space-y-3.5 rounded-[18px] border border-border bg-card p-4">
        <div className="flex items-end justify-between">
          <p className={`${display} text-[40px] leading-none`}>{Math.round(sum.calories).toLocaleString()}
            <span className="text-base text-dim">{kcalTarget ? ` / ${kcalTarget.toLocaleString()} kcal` : " kcal"}</span></p>
          {kcalTarget && <p className="text-[13px] text-[#a8a8a8]">{Math.max(0, kcalTarget - Math.round(sum.calories))} left</p>}
        </div>
        {kcalTarget
          ? <div className="h-2 rounded-full bg-[#262626]"><div className="h-2 rounded-full bg-accent" style={{ width: `${Math.min(100, Math.round((sum.calories / kcalTarget) * 100))}%` }} /></div>
          : <p className="text-xs text-dim">Michael sets your calorie target after 14 days of logging.</p>}
        <div className="grid grid-cols-3 gap-3">
          <Mini label="Protein" value={sum.protein} target={target?.protein_g ?? DAILY_TARGETS.protein_g} unit="g" />
          <Mini label="Fiber" value={sum.fiber} target={DAILY_TARGETS.fiber_g} unit="g" />
          <Mini label="Potassium" value={sum.potassium} target={DAILY_TARGETS.potassium_mg} unit="mg" fmt={k} />
        </div>
      </div>

      <MealLogger userId={user!.id} defaultSlot={nextSlot} goTos={(saved ?? []).map((g) => ({ id: g.id, name: g.name, items: g.items as FoodItem[] })) as GoTo[]} />

      <div className="space-y-2.5">
        {meals.map((m) => (
          <article key={m.id} className="flex gap-3 rounded-2xl border border-border bg-card p-2.5">
            {m.photo_path && photoUrls.get(m.photo_path) ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL
              <img src={photoUrls.get(m.photo_path)} alt="" className="size-[72px] shrink-0 rounded-xl object-cover" />
            ) : (
              <span className="grid size-[72px] shrink-0 place-items-center rounded-xl bg-[#1b1b1b] text-dim" aria-hidden="true">
                {m.source === "voice"
                  ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
                  : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /></svg>}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-accent">{SLOT_LABEL[m.meal_slot ?? "other"]} · {time(m.eaten_at)}</p>
                <p className="shrink-0 text-[13px] font-semibold">{m.calories} kcal</p>
              </div>
              <p className="mt-1 text-sm leading-snug">{(m.items as FoodItem[]).map((i) => i.name).join(", ")}</p>
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#a8a8a8]">{Math.round(Number(m.protein_g))} g protein · {Math.round(Number(m.fiber_g))} g fiber</p>
                <span className="flex items-center gap-2">
                  <EditMeal meal={{ id: m.id, items: m.items as FoodItem[], slot: (m.meal_slot ?? "other") as "meal_1" | "meal_2" | "meal_3" | "other", eatenAt: m.eaten_at, photoUrl: m.photo_path ? photoUrls.get(m.photo_path) ?? null : null }} />
                  <DeleteMeal id={m.id} />
                </span>
              </div>
            </div>
          </article>
        ))}
        {(["meal_1", "meal_2", "meal_3"] as const).filter((s) => !used.has(s)).map((s) => (
          <div key={s} className="flex items-center gap-3 rounded-2xl border border-dashed border-[#2f2f2f] p-3.5">
            <p className="text-[11px] uppercase tracking-[0.12em] text-dim">{SLOT_LABEL[s]}</p>
            <p className="text-[13px] text-dim">Not logged yet. Aim for 40 g+ protein.</p>
          </div>
        ))}
      </div>
    </section>
  );
}
