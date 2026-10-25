import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadProgram, type ItemState } from "@/lib/circles";
import { todayIn } from "@/lib/program";
import { currentWindow, DEADLINE_TZ } from "@/lib/checkin";
import { DAILY_TARGETS } from "@/lib/food";
import NotificationSettings from "@/components/NotificationSettings";
import { IconCheckin, IconHabits, IconPlate, IconScale } from "@/components/Icons";
import ItemCheck from "../circles/ItemCheck";
import { logWeight } from "./actions";

const display = "font-[family-name:var(--font-display)] uppercase";
const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);

function greeting(tz: string) {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
function timeLeft(until: Date) {
  const mins = Math.max(0, Math.round((until.getTime() - Date.now()) / 60_000));
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60);
  return d ? `${d} day${d > 1 ? "s" : ""} ${h} hrs left` : h ? `${h} hrs left` : `${mins} min left`;
}

function SectionTitle({ icon, children, as = "p" }: { icon: React.ReactNode; children: React.ReactNode; as?: "p" | "h2" }) {
  const Tag = as;
  return <Tag className={`${display} flex items-center gap-1.5 text-lg font-medium`}><span className="text-accent">{icon}</span>{children}</Tag>;
}

function Meter({ label, value, target, pct }: { label: string; value: string; target: string | null; pct: number }) {
  return (
    <span className="block">
      <span className="flex justify-between text-[11px] text-[#a8a8a8]"><span>{label}</span><span><b className="text-text">{value}</b>{target ? ` / ${target}` : label === "Calories" ? " kcal" : ""}</span></span>
      <span className="mt-1 block h-[5px] rounded-full bg-[#262626]"><span className="block h-[5px] rounded-full bg-accent" style={{ width: `${Math.min(100, Math.round(pct * 100))}%` }} /></span>
    </span>
  );
}

/** A small trend line of her last 14 days of weigh-ins. */
function Spark({ points }: { points: number[] }) {
  if (points.length < 2) return <div className="h-[26px]" />;
  const min = Math.min(...points), max = Math.max(...points), span = max - min || 1;
  const xy = points.map((p, i) => `${(2 + (i * 136) / (points.length - 1)).toFixed(1)},${(4 + ((max - p) / span) * 18).toFixed(1)}`);
  const last = xy[xy.length - 1].split(",");
  return (
    <svg width="140" height="26" viewBox="0 0 140 26" aria-hidden="true">
      <polyline points={xy.join(" ")} fill="none" stroke="#f5a623" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill="#f5a623" />
    </svg>
  );
}

export default async function TodayPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profile }, state] = await Promise.all([
    supabase.from("profiles").select("full_name, timezone").eq("id", user!.id).single(),
    loadProgram(supabase, user!.id),
  ]);
  const { today, week } = state;
  const tz = profile?.timezone ?? "America/Los_Angeles";
  const first = profile?.full_name?.split(" ")[0];

  if (week === 0) {
    return (
      <section className="space-y-4 pt-4">
        <p className="text-xs uppercase tracking-[0.15em] text-accent">Drained · Rested · Fueled · Driven</p>
        <h1 className={`${display} text-3xl font-semibold`}>Welcome{first ? `, ${first}` : ""}</h1>
        <p className="text-[15px] leading-relaxed text-[#a8a8a8]">
          Your program starts on <b className="text-text">{state.programStart
            ? new Date(state.programStart + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })
            : "your first Monday"}</b>. Your workouts and your first habits go live that morning.
        </p>
        <NotificationSettings />
        <Link href="/faq" className="flex min-h-12 items-center justify-center rounded-xl border border-border text-sm font-semibold">Browse the FAQ while you wait</Link>
      </section>
    );
  }

  const { open } = currentWindow(state.programStart);
  const [{ data: tw }, { data: weights }, { data: meals }, { data: target }, { data: done }] = await Promise.all([
    supabase.from("trajectory_weeks").select("phase, is_diet_break").eq("week_number", Math.min(week, 52)).maybeSingle(),
    supabase.from("weight_logs").select("log_date, weight_lbs").eq("client_id", user!.id).gte("log_date", addDays(today, -14)).order("log_date"),
    supabase.from("food_logs").select("eaten_at, calories, protein_g").eq("client_id", user!.id).gte("eaten_at", addDays(today, -1) + "T00:00:00Z"),
    supabase.from("nutrition_targets").select("calorie_target, protein_g").eq("client_id", user!.id).maybeSingle(),
    open ? supabase.from("checkins").select("id").eq("client_id", user!.id).eq("week_number", open.week).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const todayMeals = (meals ?? []).filter((m) => todayIn(tz, new Date(m.eaten_at)) === today);
  const kcal = todayMeals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const protein = Math.round(todayMeals.reduce((s, m) => s + Number(m.protein_g ?? 0), 0));
  const proteinTarget = target?.protein_g ?? DAILY_TARGETS.protein_g;
  const kcalTarget = target?.calorie_target ?? null;
  const w = weights ?? [];
  const weightToday = w.find((x) => x.log_date === today);
  const change = w.length >= 2 ? Number(w[w.length - 1].weight_lbs) - Number(w[0].weight_lbs) : null;

  // Every daily and weekly habit from her open medals; a habit that lives in two circles shows once.
  const seen = new Set<string>();
  const circleGroups: { name: string; color: string; medals: { number: number; label: string; items: ItemState[] }[] }[] = [];
  for (const c of state.circles) {
    for (const r of c.rings) {
      if (r.status !== "open") continue;
      const its = r.items.filter((i) => ["do", "eat", "take"].includes(i.type) && i.cadence !== "once")
        .filter((i) => { const k = i.habitKey ?? i.id; if (seen.has(k)) return false; seen.add(k); return true; })
        .sort((a, b) => (a.cadence === "daily" ? 0 : 1) - (b.cadence === "daily" ? 0 : 1));
      if (!its.length) continue;
      let cg = circleGroups.find((x) => x.name === c.name);
      if (!cg) { cg = { name: c.name, color: c.color, medals: [] }; circleGroups.push(cg); }
      cg.medals.push({ number: r.number, label: r.name, items: its });
    }
  }
  const all = circleGroups.flatMap((g) => g.medals.flatMap((m) => m.items));
  const doneCount = all.filter((i) => i.doneNow).length;

  return (
    <section className="space-y-3.5">
      <header>
        <h1 className={`${display} text-[30px] font-semibold leading-tight`}>{greeting(tz)}{first ? ` ${first}` : ""}</h1>
        {tw?.is_diet_break && <p className="text-[13px] text-[#a8a8a8]">Diet break week: eat at maintenance.</p>}
      </header>

      {open && !done && (
        <Link href="/checkin" className="flex items-center gap-3 rounded-2xl border border-accent bg-[#1f1708] p-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-black"><IconCheckin /></span>
          <span className="flex-1">
            <span className="block text-[15px] font-semibold">Your Week {open.week} check-in is open</span>
            <span className="block text-xs text-[#c9b48a]">
              Closes {new Intl.DateTimeFormat("en-US", { timeZone: DEADLINE_TZ, weekday: "short", hour: "numeric" }).format(open.closes)} · {timeLeft(open.closes)} · +10 CPs
            </span>
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f5a623" strokeWidth="2" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </Link>
      )}

      <NotificationSettings compact />

      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-3">
          <SectionTitle icon={<IconScale />}>Today&apos;s weight</SectionTitle>
          {weightToday ? (
            <>
              <p className={`${display} text-[26px] leading-none`}>{Number(weightToday.weight_lbs).toFixed(1)} <span className="text-[13px] text-dim">lbs</span></p>
              <Spark points={w.map((x) => Number(x.weight_lbs))} />
              <p className={`text-xs ${change !== null && change <= 0 ? "text-[#7ee2a8]" : "text-[#a8a8a8]"}`}>
                {change === null ? "Logged today" : `${change > 0 ? "+" : "−"}${Math.abs(change).toFixed(1)} lbs in 2 weeks`}
              </p>
            </>
          ) : (
            <form action={logWeight} className="flex flex-1 flex-col gap-1.5">
              <input type="hidden" name="date" value={today} />
              <label className="sr-only" htmlFor="weight">Today&apos;s weight in lbs</label>
              <input id="weight" name="weight" type="number" step="0.1" inputMode="decimal" placeholder="lbs" required
                className="min-h-11 w-full rounded-lg border border-[#2a2a2a] bg-bg px-3 text-lg outline-none focus:border-accent" />
              <button className="mt-auto min-h-10 rounded-lg bg-accent text-sm font-semibold text-black">Log</button>
            </form>
          )}
        </div>
        <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-3">
          <SectionTitle icon={<IconPlate />}>Today&apos;s food</SectionTitle>
          <Meter label="Calories" value={kcal.toLocaleString()} target={kcalTarget ? kcalTarget.toLocaleString() : null} pct={kcalTarget ? kcal / kcalTarget : 0} />
          <Meter label="Protein" value={`${protein}`} target={`${proteinTarget} g`} pct={protein / proteinTarget} />
          <Link href="/food" className="text-xs text-accent">{todayMeals.length ? `${todayMeals.length} meal${todayMeals.length > 1 ? "s" : ""}` : "Meals"} →</Link>
          <Link href="/food" className="mt-auto grid min-h-10 place-items-center rounded-lg bg-accent text-sm font-semibold text-black">Add meal</Link>
        </div>
      </div>

      {all.length > 0 && (
        <>
          <div className="flex items-center justify-between pt-1">
            <SectionTitle icon={<IconHabits />} as="h2">Today&apos;s habits</SectionTitle>
            <p className="text-[13px] text-[#a8a8a8]"><b className="text-text">{doneCount}</b> of {all.length} done</p>
          </div>
          <div className="-mt-1.5 h-1.5 rounded-full bg-[#262626]"><div className="h-1.5 rounded-full bg-accent" style={{ width: `${Math.round((doneCount / all.length) * 100)}%` }} /></div>
        </>
      )}

      {circleGroups.length > 0 && (
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          {circleGroups.map((cg) => (
            <div key={cg.name} className="px-3.5 py-2">
              <p className="flex items-center gap-1.5 py-1.5 text-[11px] uppercase tracking-[0.12em]" style={{ color: cg.color }}>
                <span className="size-2 rounded-full" style={{ background: cg.color }} aria-hidden="true" />{cg.name}
              </p>
              {cg.medals.map((m) => {
                const done = m.items.filter((i) => i.doneNow).length, all = m.items.length === done;
                return (
                  <details key={m.label} className="group">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full font-[family-name:var(--font-display)] text-[13px]"
                        style={all ? { background: cg.color, color: "#0a0a0a" } : { border: `2px solid ${cg.color}`, color: cg.color }}>
                        {all ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg> : m.number}
                      </span>
                      <span className="flex-1 text-[15px] leading-snug">{m.label}</span>
                      <span className={`text-xs ${all ? "text-[#7ee2a8]" : "text-[#a8a8a8]"}`}>{done}/{m.items.length}</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="2" aria-hidden="true" className="shrink-0 transition group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
                    </summary>
                    <div className="mb-2 ml-10 divide-y divide-border border-l border-border pl-3">
                      {m.items.map((it) => (
                        <ItemCheck key={it.id} itemId={it.id} done={it.doneNow} complete={it.complete} title={it.title} detail={it.detail}
                          progress={it.progress} target={it.target} cadence={it.cadence} color={cg.color} auto={it.auto} alsoIn={it.alsoIn} />
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          ))}
        </div>
      )}
      {!circleGroups.length && <p className="text-dim">No habits open yet. Your next medal opens soon.</p>}
    </section>
  );
}
