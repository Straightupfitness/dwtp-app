import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { programWeek, todayIn } from "@/lib/program";
import Avatar from "@/components/Avatar";

const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
const gap = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);

/** Michael's daily view: what every client did today and this week, and who needs a nudge. */
export default async function ActivityPage() {
  const supabase = await createClient();
  const { data: clients } = await supabase.from("profiles").select("id, full_name, email, avatar_path, program_start, timezone")
    .eq("role", "client").not("program_start", "is", null).order("full_name");
  const ids = (clients ?? []).map((c) => c.id);
  const since = addDays(todayIn("America/Los_Angeles"), -8);
  const none = { data: [] as never[] };
  const [{ data: food }, { data: weights }, { data: habits }, { data: msgs }, { data: health }] = ids.length ? await Promise.all([
    supabase.from("food_logs").select("client_id, eaten_at, calories, protein_g").in("client_id", ids).gte("eaten_at", since + "T00:00:00Z"),
    supabase.from("weight_logs").select("client_id, log_date, weight_lbs").in("client_id", ids).gte("log_date", since),
    supabase.from("habit_logs").select("client_id, log_date").in("client_id", ids).eq("done", true).gte("log_date", since),
    supabase.from("messages").select("client_id, sender_id, created_at").in("client_id", ids).gte("created_at", since + "T00:00:00Z"),
    supabase.from("health_days").select("client_id, day, steps, sleep_minutes").in("client_id", ids).gte("day", since),
  ]) : [none, none, none, none, none];

  const rows = (clients ?? []).map((c) => {
    const tz = c.timezone ?? "America/Los_Angeles";
    const today = todayIn(tz);
    const week = programWeek(c.program_start, today);
    const started = c.program_start! <= today;
    const myFood = (food ?? []).filter((f) => f.client_id === c.id).map((f) => ({ ...f, day: todayIn(tz, new Date(f.eaten_at)) }));
    const myW = (weights ?? []).filter((w) => w.client_id === c.id);
    const myH = (habits ?? []).filter((h) => h.client_id === c.id);
    const myMsg = (msgs ?? []).filter((m) => m.client_id === c.id && m.sender_id === c.id).map((m) => todayIn(tz, new Date(m.created_at)));
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((d) => ({
      d, food: myFood.filter((f) => f.day === d).length, weight: myW.some((w) => w.log_date === d), habits: myH.filter((h) => h.log_date === d).length,
    }));
    const t = days[6];
    const active = [...myFood.map((f) => f.day), ...myW.map((w) => w.log_date), ...myH.map((h) => h.log_date), ...myMsg].sort().pop() ?? null;
    const lastWeigh = myW.map((w) => w.log_date).sort().pop() ?? null;
    const reasons: string[] = [];
    if (started) {
      if (!active) reasons.push("No activity in 7+ days");
      else if (gap(today, active) >= 2) reasons.push(`Quiet for ${gap(today, active)} days`);
      if (!lastWeigh) reasons.push("No weigh-ins this week");
      else if (gap(today, lastWeigh) >= 3) reasons.push(`No weigh-in for ${gap(today, lastWeigh)} days`);
      const loggedDays = days.filter((x) => x.food).length;
      if (active && loggedDays <= 2) reasons.push(`Food logged ${loggedDays} of 7 days`);
      const kcal = myFood.filter((f) => f.day === addDays(today, -1)).reduce((s, f) => s + (f.calories ?? 0), 0);
      if (kcal > 0 && kcal < 1200) reasons.push(`Yesterday only ${kcal.toLocaleString()} kcal`);
    }
    const hd = (health ?? []).filter((h) => h.client_id === c.id);
    const hToday = hd.find((h) => h.day === today), hYest = hd.find((h) => h.day === addDays(today, -1));
    return { c, week, started, days, today: t, reasons, hToday, hYest,
      todayKcal: myFood.filter((f) => f.day === today).reduce((s, f) => s + (f.calories ?? 0), 0),
      todayProtein: Math.round(myFood.filter((f) => f.day === today).reduce((s, f) => s + Number(f.protein_g ?? 0), 0)) };
  });
  const attention = rows.filter((r) => r.reasons.length);
  const onTrack = rows.filter((r) => !r.reasons.length);

  const Card = ({ r }: { r: (typeof rows)[number] }) => (
    <li className="rounded-xl border border-border bg-card p-3">
      <Link href={`/coach/clients/${r.c.id}`} className="flex items-center gap-3">
        <Avatar name={r.c.full_name || r.c.email} path={r.c.avatar_path} size={38} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{r.c.full_name || r.c.email}</span>
          <span className="block text-xs text-dim">{r.started ? `Week ${r.week}` : "Starts soon"} · today: {r.today.food} meal{r.today.food === 1 ? "" : "s"}
            {r.today.food ? ` (${r.todayKcal.toLocaleString()} kcal, ${r.todayProtein} g protein)` : ""} · {r.today.weight ? "weighed in" : "no weigh-in"} · {r.today.habits} habits</span>
          {(r.hToday || r.hYest) && <span className="block text-xs text-[#9ec5ff]">Apple Health: {[
            r.hYest?.steps != null && `${r.hYest.steps.toLocaleString()} steps yesterday`,
            r.hToday?.sleep_minutes != null && `${(r.hToday.sleep_minutes / 60).toFixed(1)} h sleep last night`,
          ].filter(Boolean).join(" · ") || "synced"}</span>}
        </span>
      </Link>
      <div className="mt-2.5 grid grid-cols-7 gap-1" aria-label="Last 7 days">
        {r.days.map((x) => {
          const n = (x.food ? 1 : 0) + (x.weight ? 1 : 0) + (x.habits ? 1 : 0);
          return (
            <div key={x.d} className="text-center">
              <div className="h-6 rounded" title={`${x.d}: ${x.food} meals, ${x.weight ? "weighed in" : "no weigh-in"}, ${x.habits} habits`}
                style={{ background: n === 3 ? "#22c55e" : n === 2 ? "#4d7c3a" : n === 1 ? "#3a3420" : "#1e1e1e" }} />
              <span className="text-[10px] text-dim">{new Date(x.d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "narrow", timeZone: "UTC" })}</span>
            </div>
          );
        })}
      </div>
      {r.reasons.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {r.reasons.map((x) => <span key={x} className="rounded bg-[#2a1210] px-2 py-0.5 text-xs text-[#ff8a7e]">{x}</span>)}
        </div>
      )}
    </li>
  );

  return (
    <section className="space-y-4">
      <Link href="/coach" className="inline-flex min-h-11 items-center text-sm text-dim">← Clients</Link>
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Every client, every day</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl uppercase">Activity</h1>
        <p className="mt-1 text-xs text-dim">Each square is a day: green means she logged food, weighed in and checked off habits; darker means fewer of the three.</p>
      </header>
      {attention.length > 0 && <>
        <h2 className="text-[11px] uppercase tracking-[0.15em] text-[#ff8a7e]">Needs a nudge ({attention.length})</h2>
        <ul className="space-y-2">{attention.map((r) => <Card key={r.c.id} r={r} />)}</ul>
      </>}
      <h2 className="text-[11px] uppercase tracking-[0.15em] text-[#7ee2a8]">On track ({onTrack.length})</h2>
      {onTrack.length ? <ul className="space-y-2">{onTrack.map((r) => <Card key={r.c.id} r={r} />)}</ul>
        : <p className="text-sm text-dim">Nobody yet.</p>}
    </section>
  );
}
