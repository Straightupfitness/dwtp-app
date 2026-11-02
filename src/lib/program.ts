/** Program clock and ring rules (docs 23 and 27). */

export const STREAK_DAYS = 14;   // Do / Eat / Take items: 14-day streak
export const STREAK_WEEKS = 2;   // weekly items: 2 weeks in a row
export const RING_CPS = 50;
export const CIRCLE_CPS = 250;

/** Today's date (YYYY-MM-DD) in the client's time zone. */
export function todayIn(timezone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Program week: Week 1 starts on her program_start Monday. 0 = before she starts. */
export function programWeek(programStart: string | null, today: string): number {
  if (!programStart) return 0;
  const days = Math.floor((Date.parse(today) - Date.parse(programStart)) / 86_400_000);
  return days < 0 ? 0 : Math.floor(days / 7) + 1;
}

/**
 * The launch (November 1): the 26-week journey, check-ins, Strong Body Wednesday and Strong Mind Friday start
 * Monday, November 9. Nothing goes out from the app before then.
 */
export const LAUNCH_DATE = "2026-11-09";

/**
 * Her workout week, counted from her start date like programWeek but it keeps counting before it (0, −1, …),
 * so her workouts carry on while the journey hasn't started yet (November 9 launch).
 */
export function trainingWeek(programStart: string | null, today: string): number {
  if (!programStart) return 0;
  return Math.floor((Date.parse(today) - Date.parse(programStart)) / 86_400_000 / 7) + 1;
}
/** The week of her workout program for a training week (start her at week N): 0 when there isn't one. */
export function programWeekOf(week: number, workoutStartWeek: number | null) {
  const pw = week + Math.max(0, (workoutStartWeek ?? 1) - 1);
  return pw >= 1 ? pw : 0;
}

/** "Week 3", or "Pre-launch" for check-ins sent before the Nov 9 launch (renumbered 0, −1, …). */
export const weekName = (n: number) => (n >= 1 ? `Week ${n}` : "Pre-launch");

/** Count consecutive done days ending today (or yesterday, so today isn't "broken" before she logs). */
export function dailyStreak(doneDates: Set<string>, today: string): number {
  let streak = 0;
  const d = new Date(today + "T00:00:00Z");
  if (!doneDates.has(today)) d.setUTCDate(d.getUTCDate() - 1);
  while (doneDates.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return streak;
}

export const PHASE_LABEL: Record<string, string> = {
  rested: "Rested", fueled: "Fueled", driven: "Driven", continuation: "Driven",
};

/** The 26-week journey: day N of 182 and which stage she's in (Drained before she starts). */
export const JOURNEY_DAYS = 182;
export const STAGES = [
  { key: "drained", label: "Drained", from: -Infinity, to: 0 },
  { key: "rested", label: "Rested", from: 1, to: 28 },
  { key: "fueled", label: "Fueled", from: 29, to: 112 },
  { key: "driven", label: "Driven", from: 113, to: Infinity },
] as const;
export function journey(programStart: string | null, today: string) {
  if (!programStart) return null;
  const day = Math.floor((Date.parse(today) - Date.parse(programStart)) / 86_400_000) + 1;
  const stage = STAGES.findIndex((s) => day >= s.from && day <= s.to);
  return { day, stage, startsIn: day <= 0 ? 1 - day : 0 };
}
/** "in 37 days", "tomorrow", "today". */
export function inDays(n: number) {
  return n <= 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`;
}
