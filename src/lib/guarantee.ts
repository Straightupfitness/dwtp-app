import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadProgram } from "./circles";
import { windowFor } from "./checkin";
import { programWeek, todayIn } from "./program";
import { BAD_WEEK_LIMIT, loadBadWeeks } from "./bad-weeks";

/**
 * The 15 Pound Guarantee tracker (November 6), for Michael only. She qualifies by hitting 80% of her habits AND
 * 80% of her weekly check-ins, measured across the 26 weeks. A bad week (Bad Week Plan, up to 3) counts as complete.
 *
 * Habits: every day a daily habit was open (from the day its medal opened, through yesterday) and every week a weekly
 * one was open. A completed medal counts through the last day she logged its habits.
 * Check-ins: every week whose check-in window has closed (Monday noon).
 */
export type Guarantee = {
  started: boolean; week: number; weeksOver: number;
  habits: { done: number; due: number; pct: number | null };
  checkins: { done: number; due: number; pct: number | null; missed: number[] };
  badWeeks: number[]; badLeft: number;
  onTrack: boolean | null;
};

const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const pct = (done: number, due: number) => (due ? Math.round((done / due) * 1000) / 10 : null);

export async function guaranteeFor(supabase: SupabaseClient, clientId: string): Promise<Guarantee | null> {
  const { data: p } = await supabase.from("profiles").select("program_start, timezone").eq("id", clientId).single();
  const P = p?.program_start as string | null;
  if (!P) return null;
  const tz = (p?.timezone as string | null) ?? "America/Los_Angeles";
  const today = todayIn(tz), yesterday = addDays(today, -1);
  const week = programWeek(P, today);
  const end = addDays(P, 26 * 7 - 1); // last day of week 26
  const bad = (await loadBadWeeks(supabase, clientId)).slice(0, BAD_WEEK_LIMIT);
  const badSet = new Set(bad);
  const weekOf = (d: string) => Math.floor(daysBetween(P, d) / 7) + 1;
  if (week < 1) return { started: false, week, weeksOver: 0, habits: { done: 0, due: 0, pct: null }, checkins: { done: 0, due: 0, pct: null, missed: [] }, badWeeks: bad, badLeft: BAD_WEEK_LIMIT - bad.length, onTrack: null };

  // Check-ins.
  const { data: cis } = await supabase.from("checkins").select("week_number").eq("client_id", clientId).gte("week_number", 1);
  const sent = new Set((cis ?? []).map((c) => c.week_number as number));
  const now = new Date();
  const closedWeeks = Array.from({ length: Math.min(26, week) }, (_, i) => i + 1).filter((w) => windowFor(P, w).closes <= now);
  const ciDone = closedWeeks.filter((w) => sent.has(w) || badSet.has(w));
  const missed = closedWeeks.filter((w) => !sent.has(w) && !badSet.has(w));

  // Habits.
  const state = await loadProgram(supabase, clientId);
  const [{ data: logs }, { data: weights }, { data: meals }] = await Promise.all([
    supabase.from("habit_logs").select("item_id, log_date").eq("client_id", clientId).gte("log_date", P),
    supabase.from("weight_logs").select("log_date").eq("client_id", clientId).gte("log_date", P),
    supabase.from("food_logs").select("eaten_at").eq("client_id", clientId).gte("eaten_at", P + "T00:00:00Z"),
  ]);
  const logsBy = new Map<string, Set<string>>();
  for (const l of logs ?? []) { const s = logsBy.get(l.item_id as string) ?? new Set<string>(); s.add(l.log_date as string); logsBy.set(l.item_id as string, s); }
  const auto: Record<string, Set<string>> = {
    "weigh-in": new Set((weights ?? []).map((w) => w.log_date as string)),
    "log-food": new Set((meals ?? []).map((m) => todayIn(tz, new Date(m.eaten_at as string)))),
  };
  const last = yesterday < end ? yesterday : end;
  let done = 0, due = 0;
  for (const c of state.circles) for (const r of c.rings) {
    if ((r.status !== "open" && r.status !== "complete") || !r.opensOn) continue;
    for (const it of r.items) {
      if (it.type === "hit" || it.cadence === "once") continue;
      const dates = (it.habitKey && auto[it.habitKey]) || logsBy.get(it.id) || new Set<string>();
      const from = r.opensOn > P ? r.opensOn : P;
      let to = last;
      if (r.status === "complete") { const lastLog = [...dates].sort().pop(); if (!lastLog) continue; if (lastLog < to) to = lastLog; }
      if (to < from) continue;
      if (it.cadence === "weekly") {
        const doneWeeks = new Set([...dates].filter((d) => d >= from && d <= to).map(weekOf));
        for (let w = weekOf(from); w <= weekOf(to); w++) {
          if (addDays(P, w * 7 - 1) > last) break; // count a weekly habit once its week is over
          due++; if (doneWeeks.has(w) || badSet.has(w)) done++;
        }
      } else {
        for (let d = from; d <= to; d = addDays(d, 1)) { due++; if (dates.has(d) || badSet.has(weekOf(d))) done++; }
      }
    }
  }

  const hp = pct(done, due), cp = pct(ciDone.length, closedWeeks.length);
  return {
    started: true, week, weeksOver: closedWeeks.length,
    habits: { done, due, pct: hp }, checkins: { done: ciDone.length, due: closedWeeks.length, pct: cp, missed },
    badWeeks: bad, badLeft: BAD_WEEK_LIMIT - bad.length,
    onTrack: hp === null && cp === null ? null : (hp ?? 100) >= 80 && (cp ?? 100) >= 80,
  };
}
