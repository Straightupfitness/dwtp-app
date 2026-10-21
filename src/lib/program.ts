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
