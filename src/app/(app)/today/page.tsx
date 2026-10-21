import { createClient } from "@/lib/supabase/server";
import { dailyStreak, programWeek, todayIn, PHASE_LABEL, STREAK_DAYS } from "@/lib/program";
import HabitCheck from "./HabitCheck";
import { logWeight } from "./actions";

type Item = { id: string; title: string; detail: string | null; item_type: string; cadence: string;
  rings: { name: string; ring_number: number; circles: { name: string } } };

export default async function TodayPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles")
    .select("full_name, timezone, program_start").eq("id", user!.id).single();

  const today = todayIn(profile?.timezone ?? "America/Los_Angeles");
  const week = programWeek(profile?.program_start ?? null, today);

  if (week === 0) {
    return (
      <section className="space-y-3">
        <h1 className="font-[family-name:var(--font-display)] text-3xl uppercase">Welcome{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}</h1>
        <p className="text-dim">Your program starts on {profile?.program_start ?? "your first Monday"}. Your workouts go live that morning.</p>
      </section>
    );
  }

  const [{ data: tw }, { data: weekRings }, { data: ownRings }] = await Promise.all([
    supabase.from("trajectory_weeks").select("phase, is_diet_break").eq("week_number", Math.min(week, 52)).maybeSingle(),
    supabase.from("trajectory_week_rings").select("ring_id").lte("week_number", week),
    supabase.from("client_rings").select("ring_id, status").eq("client_id", user!.id),
  ]);
  const done = new Set((ownRings ?? []).filter((r) => r.status === "complete").map((r) => r.ring_id));
  const ringIds = [...new Set([...(weekRings ?? []).map((r) => r.ring_id), ...(ownRings ?? []).map((r) => r.ring_id)])]
    .filter((id) => !done.has(id));

  const { data: items } = ringIds.length
    ? await supabase.from("ring_items").select("id, title, detail, item_type, cadence, rings(name, ring_number, circles(name))")
        .in("ring_id", ringIds).in("item_type", ["do", "eat", "take"]).eq("cadence", "daily").order("sort")
    : { data: [] as Item[] };

  const since = new Date(Date.parse(today) - 21 * 86_400_000).toISOString().slice(0, 10);
  const [{ data: logs }, { data: weightToday }] = await Promise.all([
    supabase.from("habit_logs").select("item_id, log_date").eq("client_id", user!.id).gte("log_date", since),
    supabase.from("weight_logs").select("weight_lbs").eq("client_id", user!.id).eq("log_date", today).maybeSingle(),
  ]);
  const byItem = new Map<string, Set<string>>();
  (logs ?? []).forEach((l) => byItem.set(l.item_id, (byItem.get(l.item_id) ?? new Set()).add(l.log_date)));

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm uppercase tracking-widest text-accent">
          Week {week} · {PHASE_LABEL[tw?.phase ?? "rested"]}{tw?.is_diet_break ? " · Diet break" : ""}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl uppercase">Today</h1>
      </header>

      <form action={logWeight} className="flex items-end gap-2 rounded-xl border border-border bg-card p-3">
        <input type="hidden" name="date" value={today} />
        <label className="flex-1 text-sm text-dim">
          Today&apos;s weight (lbs)
          <input name="weight" type="number" step="0.1" inputMode="decimal" defaultValue={weightToday?.weight_lbs ?? ""}
            className="mt-1 block w-full rounded-lg border border-border bg-bg px-3 py-2 text-lg text-text outline-none focus:border-accent" />
        </label>
        <button className="rounded-lg bg-accent px-4 py-2 font-semibold text-black">{weightToday ? "Update" : "Log"}</button>
      </form>

      <div className="space-y-2">
        <h2 className="text-sm uppercase tracking-widest text-dim">Your habits</h2>
        {(items as unknown as Item[] ?? []).map((it) => {
          const dates = byItem.get(it.id) ?? new Set<string>();
          return (
            <div key={it.id}>
              <p className="mb-1 text-xs text-dim">{it.rings.circles.name} · {it.rings.name}</p>
              <HabitCheck itemId={it.id} date={today} done={dates.has(today)} title={it.title} detail={it.detail}
                streak={dailyStreak(dates, today)} target={STREAK_DAYS} />
            </div>
          );
        })}
        {!items?.length && <p className="text-dim">No habits yet. They start in Week 1.</p>}
      </div>
    </section>
  );
}
