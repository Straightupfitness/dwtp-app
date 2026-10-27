/**
 * Her calendar (decided October 26): everything with a day attached, for one week at a time.
 * Workouts (her chosen days), Real Talk Tuesday, Habits & Homework, SBW, SMF, check-in open/close,
 * diet breaks, and new medals opening.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadProgram } from "./circles";
import { loadLessons } from "./lessons";
import { DEADLINE_TZ, zonedInstant } from "./checkin";
import { programWeek, todayIn } from "./program";

export type CalEvent = {
  kind: "week" | "workout" | "call" | "sbw" | "smf" | "checkin" | "medal" | "break";
  title: string; detail?: string; time?: string; href?: string; external?: boolean; color?: string; locked?: boolean;
};
export type CalDay = { date: string; events: CalEvent[] };

export const RTT_HOUR = 16, RTT_MINUTE = 30; // Real Talk Tuesday: 4:30 PM Pacific
const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
const weekday = (d: string) => new Date(d + "T12:00:00Z").getUTCDay();

/** Default workout days from her strength frequency: 1x Mon, 2x Mon/Thu, 3x Mon/Wed/Fri. */
export function defaultWorkoutDays(perWeek: number | null): number[] {
  return perWeek === 1 ? [1] : perWeek === 2 ? [1, 4] : [1, 3, 5];
}

export async function loadWeek(supabase: SupabaseClient, clientId: string, offset = 0) {
  const { data: p } = await supabase.from("profiles").select("program_start, timezone, workout_days, strength_days_per_week").eq("id", clientId).single();
  const tz = p?.timezone ?? "America/Los_Angeles";
  const today = todayIn(tz);
  // Weeks run Monday to Sunday, like the program.
  const monday = addDays(today, -((weekday(today) + 6) % 7) + offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const start = p?.program_start ?? null;
  const week = programWeek(start, monday);
  const workoutDays: number[] = p?.workout_days?.length ? p.workout_days : defaultWorkoutDays(p?.strength_days_per_week ?? null);

  const [{ data: settings }, { data: calls }, { data: tw }, lessons, program] = await Promise.all([
    supabase.from("program_settings").select("key, value").in("key", ["rtt_zoom_url", "trainerize_url"]),
    supabase.from("calls").select("call_date, title, replay_url, passcode, cancelled").gte("call_date", days[0]).lte("call_date", days[6]),
    week ? supabase.from("trajectory_weeks").select("is_diet_break, checkin_is_video").eq("week_number", Math.min(week, 52)).maybeSingle() : Promise.resolve({ data: null }),
    loadLessons(supabase, clientId),
    loadProgram(supabase, clientId),
  ]);
  const setting = (k: string) => settings?.find((s) => s.key === k)?.value || null;
  const time = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d);
  const inProgram = !!start && week >= 1 && week <= 26;

  const out: CalDay[] = days.map((date) => ({ date, events: [] }));
  const on = (date: string, e: CalEvent) => out.find((d) => d.date === date)?.events.push(e);

  if (inProgram) {
    const hh = lessons.all.find((l) => l.kind === "hh" && l.week === week);
    on(days[0], { kind: "week", title: `Week ${week} starts`, detail: hh?.open ? "Your Habits & Homework" : hh?.lockedReason ?? undefined, href: hh?.open ? `/lessons/${hh.id}` : "/lessons", locked: !hh?.open });
    if (tw?.is_diet_break) on(days[0], { kind: "break", title: "Diet break week", detail: "Eat at maintenance. Keep logging and 40 g+ protein per meal." });
  }
  if (start && days[6] >= start) {
    for (const d of days) if (d >= start && workoutDays.includes(weekday(d))) {
      on(d, { kind: "workout", title: "Workout", detail: "In Trainerize", href: setting("trainerize_url") ?? undefined, external: true });
    }
  }
  // Real Talk Tuesday, every week.
  const tue = days[1], call = calls?.find((c) => c.call_date === tue);
  if (!call?.cancelled) {
    const at = new Date(zonedInstant(tue, RTT_HOUR, DEADLINE_TZ).getTime() + RTT_MINUTE * 60_000);
    const past = Date.now() > at.getTime() + 90 * 60_000;
    on(tue, {
      kind: "call", title: "Real Talk Tuesday", time: time(at),
      detail: [call?.title, past ? (call?.replay_url ? `Watch the replay${call.passcode ? ` (passcode ${call.passcode})` : ""}` : "Replay coming soon") : "Group call with Michael on Zoom"].filter(Boolean).join(" · "),
      href: past ? call?.replay_url ?? undefined : setting("rtt_zoom_url") ?? undefined, external: true,
    });
  } else on(tue, { kind: "call", title: "No Real Talk Tuesday this week", detail: call.title || undefined });

  if (inProgram) {
    for (const kind of ["sbw", "smf"] as const) {
      const l = lessons.all.find((x) => x.kind === kind && x.week === week);
      if (l) on(days[kind === "sbw" ? 2 : 4], { kind, title: kind === "sbw" ? "Strong Body Wednesday" : "Strong Mind Friday", detail: l.title, href: `/lessons/${l.id}`, locked: !l.open });
    }
    const opens = zonedInstant(days[4], 0, DEADLINE_TZ);
    on(days[4], { kind: "checkin", title: `Week ${week} check-in opens`, detail: tw?.checkin_is_video ? "A video check-in this week" : "3–4 minutes, +10 CPs", time: time(opens), href: "/checkin" });
  }
  // Monday: last week's check-in closes at noon Pacific.
  const prevWeek = programWeek(start, addDays(days[0], -1));
  if (start && prevWeek >= 1 && prevWeek <= 26) {
    on(days[0], { kind: "checkin", title: `Week ${prevWeek} check-in closes`, time: time(zonedInstant(days[0], 12, DEADLINE_TZ)), href: "/checkin" });
  }
  // New medals opening this week.
  for (const c of program.circles) for (const r of c.rings) {
    if (r.opensOn && r.opensOn >= days[0] && r.opensOn <= days[6] && (r.status === "upcoming" || r.status === "open"))
      on(r.opensOn, { kind: "medal", title: `New medal: ${r.name}`, detail: c.name, href: `/circles/${c.slug}`, color: c.color });
  }
  const order: CalEvent["kind"][] = ["break", "checkin", "week", "medal", "workout", "call", "sbw", "smf"];
  out.forEach((d) => d.events.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)));
  return { today, days: out, week, start, workoutDays, monday };
}
