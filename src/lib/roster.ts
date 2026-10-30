/**
 * Michael's client overview (October 29): every client's snapshot in one pass, with a handful of queries for the
 * whole roster (not one set per client).
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "./supabase/admin";
import { currentWindow, windowFor } from "./checkin";
import { programWeek, todayIn } from "./program";
import { daysFor } from "./workouts";
import { DAILY_TARGETS } from "./food";

const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
/** Every row, 1,000 at a time (Supabase returns at most 1,000 per request). */
async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>) {
  const out: T[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data } = await page(from, from + 999);
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export type RosterRow = {
  id: string; name: string; first: string; email: string | null; avatar: string | null; status: string; week: number;
  weight: number | null; weighedOn: string | null; daysSinceWeigh: number | null; weightChange14: number | null; goalWeight: number | null;
  stepsAvg: number | null; stepsDays: number;
  kcalYesterday: number | null; kcalAvg: number | null; kcalTarget: number | null; proteinAvg: number | null; proteinTarget: number;
  foodDays7: number; waterAvg: number | null;
  checkin: { week: number; state: "needs-reply" | "replied" | "missed" | "open" | "none"; id: string | null } | null;
  missedCheckin: boolean; noFoodYesterday: boolean;
  lastWorkoutWeek: { week: number; planned: number; done: number } | null; missedWorkouts: boolean;
  lastSeen: string | null; hoursSinceSeen: number | null; notSeen48: boolean;
  cpsWeek: number; flags: string[];
};

export async function loadRoster(supabase: SupabaseClient): Promise<RosterRow[]> {
  const { data: clients } = await supabase.from("profiles")
    .select("id, full_name, email, program_start, status, timezone, avatar_path, goal_weight_lbs, strength_days_per_week, workout_program, workout_start_week")
    .eq("role", "client").order("full_name");
  const list = (clients ?? []).filter((c) => c.status !== "cancelled");
  const ids = list.map((c) => c.id);
  if (!ids.length) return [];
  const since = addDays(todayIn("America/Los_Angeles"), -10);

  const [weights, food, steps, water, { data: targets }, checkins, sessions, { data: cps }, { data: phases }, seen] = await Promise.all([
    all<{ client_id: string; log_date: string; weight_lbs: number }>((a, b) => supabase.from("weight_logs").select("client_id, log_date, weight_lbs").in("client_id", ids).gte("log_date", addDays(since, -110)).order("log_date", { ascending: false }).range(a, b)),
    all<{ client_id: string; eaten_at: string; calories: number | null; protein_g: number | null }>((a, b) => supabase.from("food_logs").select("client_id, eaten_at, calories, protein_g").in("client_id", ids).gte("eaten_at", addDays(since, -1) + "T00:00:00Z").order("eaten_at").range(a, b)),
    all<{ client_id: string; day: string; steps: number | null }>((a, b) => supabase.from("health_days").select("client_id, day, steps").in("client_id", ids).gte("day", since).order("day").range(a, b)),
    all<{ client_id: string; day: string; oz: number }>((a, b) => supabase.from("water_days").select("client_id, day, oz").in("client_id", ids).gte("day", since).order("day").range(a, b)),
    supabase.from("nutrition_targets").select("client_id, calorie_target, protein_g").in("client_id", ids),
    all<{ id: string; client_id: string; week_number: number; flags: string[] | null; checkin_replies: unknown }>((a, b) => supabase.from("checkins").select("id, client_id, week_number, flags, checkin_replies(sent_at)").in("client_id", ids).order("week_number", { ascending: false }).range(a, b)),
    all<{ client_id: string; program_week: number }>((a, b) => supabase.from("workout_sessions").select("client_id, program_week, workouts!inner(kind)").in("client_id", ids).not("completed_at", "is", null).eq("workouts.kind", "strength").order("started_at").range(a, b)),
    supabase.from("cp_totals").select("client_id, this_week").in("client_id", ids),
    supabase.from("program_phases").select("program, weeks, first_week, phase_workouts(day, from_week, to_week, workouts(kind))"),
    lastSeenMap(),
  ]);

  type PW = { day: number | null; from_week: number | null; to_week: number | null; workouts: { kind: string } | null };
  const plannedFor = (programId: string, pweek: number, perWeek: number | null) => {
    const ph = (phases ?? []).find((x) => x.program === programId && pweek >= x.first_week && pweek < x.first_week + x.weeks);
    if (!ph) return 0;
    const wop = pweek - ph.first_week + 1;
    const days = [...new Set(((ph.phase_workouts ?? []) as unknown as PW[])
      .filter((l) => l.workouts?.kind === "strength" && l.day && (l.from_week ?? 1) <= wop && wop <= (l.to_week ?? 99)).map((l) => l.day!))];
    return daysFor(perWeek, days).length;
  };

  const now = Date.now();
  return list.map((c) => {
    const tz = c.timezone ?? "America/Los_Angeles";
    const today = todayIn(tz), yesterday = addDays(today, -1);
    const week = programWeek(c.program_start, today);
    const name = c.full_name || c.email || "Client";

    const w = weights.filter((x) => x.client_id === c.id);
    const latest = w[0] ?? null;
    const twoWeeksAgo = w.find((x) => x.log_date <= addDays(today, -14));
    const weightChange14 = latest && twoWeeksAgo ? Math.round((Number(latest.weight_lbs) - Number(twoWeeksAgo.weight_lbs)) * 10) / 10 : null;

    // Food: the last 7 finished days.
    const days7 = Array.from({ length: 7 }, (_, i) => addDays(today, -(i + 1)));
    const byDay = new Map<string, { kcal: number; protein: number }>();
    for (const f of food.filter((x) => x.client_id === c.id)) {
      const d = todayIn(tz, new Date(f.eaten_at));
      const t = byDay.get(d) ?? { kcal: 0, protein: 0 };
      t.kcal += f.calories ?? 0; t.protein += Number(f.protein_g ?? 0); byDay.set(d, t);
    }
    const logged = days7.filter((d) => byDay.has(d));
    const st = steps.filter((x) => x.client_id === c.id && days7.includes(x.day) && (x.steps ?? 0) > 0);
    const wa = water.filter((x) => x.client_id === c.id && days7.includes(x.day) && x.oz > 0);
    const t = (targets ?? []).find((x) => x.client_id === c.id);

    // Check-in: the open one, or the last one that closed.
    const mine = checkins.filter((k) => k.client_id === c.id);
    let checkin: RosterRow["checkin"] = null, missedCheckin = false;
    if (c.program_start && week >= 1) {
      const { open } = currentWindow(c.program_start);
      const lastClosed = [week, week - 1].find((x) => x >= 1 && new Date() >= windowFor(c.program_start!, x).closes) ?? null;
      const wk = open?.week ?? lastClosed;
      if (wk) {
        const k = mine.find((x) => x.week_number === wk);
        const replied = k && (Array.isArray(k.checkin_replies) ? k.checkin_replies[0]?.sent_at : (k.checkin_replies as { sent_at?: string } | null)?.sent_at);
        checkin = { week: wk, id: k?.id ?? null, state: k ? (replied ? "replied" : "needs-reply") : open?.week === wk ? "open" : "missed" };
      }
      // Missed: the most recent closed check-in isn't there.
      missedCheckin = !!lastClosed && !mine.some((x) => x.week_number === lastClosed);
    }

    // Workouts: last finished program week.
    let lastWorkoutWeek: RosterRow["lastWorkoutWeek"] = null;
    if (week >= 2) {
      const lw = week - 1, pweek = lw + Math.max(0, (c.workout_start_week ?? 1) - 1);
      const planned = plannedFor(c.workout_program ?? "sltp", pweek, c.strength_days_per_week);
      const done = sessions.filter((s) => s.client_id === c.id && s.program_week === lw).length;
      lastWorkoutWeek = { week: lw, planned, done };
    }

    const lastSeen = seen.get(c.id) ?? null;
    const hoursSinceSeen = lastSeen ? Math.round((now - Date.parse(lastSeen)) / 3_600_000) : null;
    const daysSinceWeigh = latest ? Math.round((Date.parse(today) - Date.parse(latest.log_date)) / 86_400_000) : null;
    const active = week >= 1;
    const row: RosterRow = {
      id: c.id, name, first: name.split(" ")[0], email: c.email, avatar: c.avatar_path, status: c.status, week,
      weight: latest ? Number(latest.weight_lbs) : null, weighedOn: latest?.log_date ?? null, daysSinceWeigh, weightChange14,
      goalWeight: c.goal_weight_lbs != null ? Number(c.goal_weight_lbs) : null,
      stepsAvg: st.length ? Math.round(avg(st.map((x) => x.steps!))!) : null, stepsDays: st.length,
      kcalYesterday: byDay.has(yesterday) ? Math.round(byDay.get(yesterday)!.kcal) : null,
      kcalAvg: logged.length ? Math.round(avg(logged.map((d) => byDay.get(d)!.kcal))!) : null,
      kcalTarget: t?.calorie_target ?? null,
      proteinAvg: logged.length ? Math.round(avg(logged.map((d) => byDay.get(d)!.protein))!) : null,
      proteinTarget: t?.protein_g ?? DAILY_TARGETS.protein_g,
      foodDays7: logged.length, waterAvg: wa.length ? Math.round(avg(wa.map((x) => x.oz))!) : null,
      checkin, missedCheckin, noFoodYesterday: active && !byDay.has(yesterday),
      lastWorkoutWeek, missedWorkouts: !!lastWorkoutWeek && lastWorkoutWeek.planned > 0 && lastWorkoutWeek.done < lastWorkoutWeek.planned,
      lastSeen, hoursSinceSeen, notSeen48: hoursSinceSeen === null || hoursSinceSeen >= 48,
      cpsWeek: (cps ?? []).find((x) => x.client_id === c.id)?.this_week ?? 0,
      flags: ((mine[0]?.flags as string[] | null) ?? []),
    };
    return row;
  });
}

/** Last time each client used the app: the app's own record, or her last sign-in, whichever is later. */
async function lastSeenMap() {
  const out = new Map<string, string>();
  try {
    const db = adminClient();
    for (let page = 1; page <= 10; page++) {
      const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      for (const u of data?.users ?? []) if (u.last_sign_in_at) out.set(u.id, u.last_sign_in_at);
      if ((data?.users?.length ?? 0) < 1000) break;
    }
    const { data: seen, error } = await db.from("profiles").select("id, last_seen_at").not("last_seen_at", "is", null);
    if (!error) for (const s of seen ?? []) { const was = out.get(s.id); if (!was || s.last_seen_at > was) out.set(s.id, s.last_seen_at); }
  } catch { /* no service key locally */ }
  return out;
}
