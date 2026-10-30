import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadProgram } from "@/lib/circles";
import { todayIn } from "@/lib/program";
import BackButton from "@/components/BackButton";
import { HabitDay, WaterDay, WeightDay } from "./DayForms";

const display = "font-[family-name:var(--font-display)] uppercase";
const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
const label = (d: string, today: string) => d === today ? "Today" : d === addDays(today, -1) ? "Yesterday"
  : new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/**
 * Missed a day? (October 30) Fill in a past day: weight, water, habits and food, for up to two weeks back.
 */
export default async function LogDay({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const state = await loadProgram(supabase, user!.id);
  const today = state.today;
  const asked = (await searchParams).d;
  const day = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= today && asked >= addDays(today, -14) ? asked : addDays(today, -1);
  const { data: p } = await supabase.from("profiles").select("water_goal_oz, timezone").eq("id", user!.id).single();

  const daily = state.circles.flatMap((c) => c.rings.filter((r) => r.status === "open" || r.status === "complete").flatMap((r) => r.items
    .filter((i) => ["do", "eat", "take"].includes(i.type) && i.cadence === "daily").map((i) => ({ ...i, color: c.color }))));
  const seen = new Set<string>();
  const habits = daily.filter((i) => { const k = i.habitKey ?? i.id; if (seen.has(k)) return false; seen.add(k); return true; });
  const [{ data: w }, { data: water }, { data: logs }, { data: food }] = await Promise.all([
    supabase.from("weight_logs").select("weight_lbs").eq("client_id", user!.id).eq("log_date", day).maybeSingle(),
    supabase.from("water_days").select("oz").eq("client_id", user!.id).eq("day", day).maybeSingle(),
    habits.length ? supabase.from("habit_logs").select("item_id").eq("client_id", user!.id).eq("log_date", day).in("item_id", habits.map((h) => h.id)) : Promise.resolve({ data: [] }),
    supabase.from("food_logs").select("eaten_at, calories").eq("client_id", user!.id).gte("eaten_at", addDays(day, -1) + "T00:00:00Z").lt("eaten_at", addDays(day, 2) + "T00:00:00Z"),
  ]);
  const doneIds = new Set((logs ?? []).map((l) => l.item_id as string));
  const tz = p?.timezone ?? "America/Los_Angeles";
  const mealsThatDay = (food ?? []).filter((m) => todayIn(tz, new Date(m.eaten_at)) === day);
  const days = Array.from({ length: 8 }, (_, i) => addDays(today, -i)).reverse();
  const card = "space-y-2.5 rounded-2xl border border-border bg-card p-3.5";

  return (
    <section className="space-y-4">
      <BackButton fallback="/today" />
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Missed a day? No problem</p>
        <h1 className={`${display} mt-1 text-[30px] font-semibold`}>Fill in {label(day, today)}</h1>
      </header>
      <nav className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="Pick a day">
        {days.map((d) => (
          <Link key={d} href={`/log?d=${d}`} aria-current={d === day ? "page" : undefined}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] ${d === day ? "border-accent bg-accent font-semibold text-black" : "border-[#2f2f2f] text-[#cfcfcf]"}`}>{label(d, today)}</Link>
        ))}
        <Link href={`/log?d=${addDays(today, -14)}`} className="shrink-0 rounded-full border border-[#2f2f2f] px-3 py-1.5 text-[13px] text-dim">Older…</Link>
      </nav>

      <div className={card}>
        <p className={`${display} text-[17px]`}>Weight</p>
        <WeightDay key={day} date={day} value={w ? Number(w.weight_lbs) : null} />
      </div>

      <div className={card}>
        <div className="flex items-baseline justify-between"><p className={`${display} text-[17px]`}>Food</p><span className="text-[13px] text-dim">{mealsThatDay.length ? `${mealsThatDay.length} meals · ${mealsThatDay.reduce((s, m) => s + (m.calories ?? 0), 0)} kcal` : "Nothing logged"}</span></div>
        <Link href={day === today ? "/food" : `/food?d=${day}`} className="flex min-h-11 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-black">{mealsThatDay.length ? "See or add meals" : "Log meals"} for {label(day, today)}</Link>
      </div>

      <div className={card}>
        <p className={`${display} text-[17px]`}>Water</p>
        <WaterDay key={day} date={day} value={water?.oz ?? 0} goal={p?.water_goal_oz ?? 128} />
      </div>

      {habits.length > 0 && (
        <div className={card}>
          <div className="flex items-baseline justify-between"><p className={`${display} text-[17px]`}>Daily habits</p><span className="text-[13px] text-dim">{habits.filter((h) => doneIds.has(h.id)).length} of {habits.length}</span></div>
          <div className="divide-y divide-border">
            {habits.map((h) => <HabitDay key={`${day}:${h.id}`} id={h.id} date={day} title={h.title} done={doneIds.has(h.id)} color={h.color} auto={h.auto} />)}
          </div>
        </div>
      )}
      <p className="text-[12px] text-dim">Steps come from your phone (or your weekly check-in), so there&apos;s nothing to fill in here.</p>
    </section>
  );
}
