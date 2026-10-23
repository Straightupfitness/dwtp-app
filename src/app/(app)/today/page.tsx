import { createClient } from "@/lib/supabase/server";
import { loadProgram, type ItemState } from "@/lib/circles";
import { PHASE_LABEL } from "@/lib/program";
import ItemCheck from "../circles/ItemCheck";
import { logWeight } from "./actions";
import Link from "next/link";
import { currentWindow, DEADLINE_TZ } from "@/lib/checkin";

export default async function TodayPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profile }, state] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user!.id).single(),
    loadProgram(supabase, user!.id),
  ]);
  const { today, week } = state;

  if (week === 0) {
    return (
      <section className="space-y-3">
        <h1 className="font-[family-name:var(--font-display)] text-3xl uppercase">Welcome{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}</h1>
        <p className="text-dim">Your program starts on {state.programStart ?? "your first Monday"}. Your workouts go live that morning.</p>
      </section>
    );
  }

  const { open } = currentWindow(state.programStart);
  const [{ data: tw }, { data: weightToday }, { data: done }] = await Promise.all([
    supabase.from("trajectory_weeks").select("phase, is_diet_break").eq("week_number", Math.min(week, 52)).maybeSingle(),
    supabase.from("weight_logs").select("weight_lbs").eq("client_id", user!.id).eq("log_date", today).maybeSingle(),
    open ? supabase.from("checkins").select("id").eq("client_id", user!.id).eq("week_number", open.week).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const closes = open ? new Intl.DateTimeFormat("en-US", { timeZone: DEADLINE_TZ, weekday: "long", hour: "numeric" }).format(open.closes) : "";

  // Every daily and weekly habit from her open rings; a habit that lives in two circles shows once.
  const seen = new Set<string>();
  const groups: { label: string; color: string; daily: ItemState[]; weekly: ItemState[] }[] = [];
  for (const c of state.circles) {
    for (const r of c.rings) {
      if (r.status !== "open") continue;
      const its = r.items.filter((i) => ["do", "eat", "take"].includes(i.type) && i.cadence !== "once")
        .filter((i) => { const k = i.habitKey ?? i.id; if (seen.has(k)) return false; seen.add(k); return true; });
      if (its.length) groups.push({ label: `${c.name} · ${r.name}`, color: r.color,
        daily: its.filter((i) => i.cadence === "daily"), weekly: its.filter((i) => i.cadence === "weekly") });
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm uppercase tracking-widest text-accent">
          Week {week} · {PHASE_LABEL[tw?.phase ?? "rested"]}{tw?.is_diet_break ? " · Diet break" : ""}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl uppercase">Today</h1>
      </header>

      {open && !done && (
        <Link href="/checkin" className="block rounded-xl border border-accent bg-accent/10 p-4">
          <p className="font-semibold text-accent">Your Week {open.week} check-in is open</p>
          <p className="text-sm text-dim">Closes {closes} Pacific · +10 CPs</p>
        </Link>
      )}

      <form action={logWeight} className="flex items-end gap-2 rounded-xl border border-border bg-card p-3">
        <input type="hidden" name="date" value={today} />
        <label className="flex-1 text-sm text-dim">
          Today&apos;s weight (lbs)
          <input name="weight" type="number" step="0.1" inputMode="decimal" defaultValue={weightToday?.weight_lbs ?? ""}
            className="mt-1 block w-full rounded-lg border border-border bg-bg px-3 py-2 text-lg text-text outline-none focus:border-accent" />
        </label>
        <button className="rounded-lg bg-accent px-4 py-2 font-semibold text-black">{weightToday ? "Update" : "Log"}</button>
      </form>

      <div className="space-y-4">
        <h2 className="text-sm uppercase tracking-widest text-dim">Your habits</h2>
        {groups.map((g) => (
          <div key={g.label} className="rounded-xl border border-border bg-card px-3 py-1">
            <p className="pt-2 text-xs uppercase tracking-wider" style={{ color: g.color }}>{g.label}</p>
            {[...g.daily, ...g.weekly].map((it) => (
              <ItemCheck key={it.id} itemId={it.id} done={it.doneNow} complete={it.complete} title={it.title} detail={it.detail}
                progress={it.progress} target={it.target} cadence={it.cadence} color={g.color} auto={it.auto} />
            ))}
          </div>
        ))}
        {!groups.length && <p className="text-dim">No habits open yet.</p>}
      </div>
    </section>
  );
}
