/**
 * Weekly check-in rules (doc 28).
 * - Opens Friday of program week N (when SMF goes out) and closes Monday at noon Pacific. No late check-ins.
 * - Video weeks: 4, 8, 12, 16, 20, 26, 32, 36, 40, 44, 48, 52 (from trajectory_weeks.checkin_is_video).
 * - The same core every week, plus extra questions for that week's moment.
 */
export const DEADLINE_TZ = "America/Los_Angeles";

const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);

/** The UTC instant of a wall-clock time in a time zone (e.g. Monday 12:00 in Los Angeles). */
export function zonedInstant(date: string, hour: number, tz: string): Date {
  const guess = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), hour);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const asIfUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess - (asIfUtc - guess));
}

export type CheckinWindow = { week: number; opens: Date; closes: Date };

export function windowFor(programStart: string, week: number): CheckinWindow {
  const friday = addDays(programStart, (week - 1) * 7 + 4);
  const monday = addDays(programStart, week * 7);
  return { week, opens: zonedInstant(friday, 0, DEADLINE_TZ), closes: zonedInstant(monday, 12, DEADLINE_TZ) };
}

/** The check-in she can submit right now, if any, and the next one coming. */
export function currentWindow(programStart: string | null, now = new Date()) {
  if (!programStart) return { open: null as CheckinWindow | null, next: null as CheckinWindow | null };
  const days = Math.floor((now.getTime() - Date.parse(programStart + "T00:00:00Z")) / 86_400_000);
  const week = Math.floor(days / 7) + 1;
  for (const w of [week - 1, week]) {
    if (w < 1) continue;
    const win = windowFor(programStart, w);
    if (now >= win.opens && now < win.closes) return { open: win, next: null };
  }
  const nextWeek = Math.max(1, now < windowFor(programStart, Math.max(1, week)).opens ? week : week + 1);
  return { open: null, next: windowFor(programStart, nextWeek) };
}

export type Question = {
  id: string; label: string; help?: string;
  kind: "scale" | "text" | "choice";
  options?: string[];
  optional?: boolean;
  video?: boolean;  // answered in the video on video weeks
};

type Week = { checkin_type: string; checkin_is_video: boolean; is_diet_break: boolean; moments: string[] };

export function questionsFor(week: number, tw: Week | null, opts: { onFullYear?: boolean } = {}): Question[] {
  const type = tw?.checkin_type ?? "standard";
  const q: Question[] = [
    { id: "sleep", label: "Sleep this week", kind: "scale" },
    { id: "energy", label: "Energy this week", kind: "scale" },
    { id: "stress", label: "Stress this week", kind: "scale" },
    { id: "hunger", label: "Hunger this week", help: "1 = never hungry, 10 = always hungry", kind: "scale" },
  ];
  const extra: Question[] = [];

  if (type === "week1") {
    extra.push(
      { id: "why_now", label: "What made you finally decide to start now?", kind: "text" },
      { id: "got_in_way", label: "What has gotten in the way every other time you tried?", kind: "text" },
      { id: "follow_up", label: "When you fall off, how do you want me to follow up with you?", kind: "text" },
    );
  }
  if (type === "four_week" || [4, 8, 16, 20, 32, 36, 40, 44, 48].includes(week)) {
    extra.push(
      { id: "wins_4wk", label: "Your wins from the last 4 weeks", kind: "text", video: true },
      { id: "obstacle_4wk", label: "Your biggest obstacle from the last 4 weeks", kind: "text", video: true },
    );
  }
  if (tw?.moments.includes("sleep_better_checkpoint")) {
    extra.push(
      { id: "sleep_vs_before", label: "Compared to before you started, your sleep is:", kind: "choice",
        options: ["Much better", "A bit better", "The same", "Worse"] },
      { id: "wakeups_3am", label: "How many nights this week did you wake up at 3 AM?", kind: "choice", options: ["0", "1–2", "3–4", "5+"] },
      { id: "mornings_now", label: "What's different about your mornings and afternoons now?", kind: "text", video: true },
    );
  }
  if (tw?.is_diet_break) {
    extra.push(
      { id: "maintenance_feel", label: "How did eating at maintenance feel?", kind: "choice", options: ["Easier", "About the same", "Harder"] },
      { id: "energy_workouts", label: "Did your energy or workouts change this week?", kind: "text", video: true },
    );
  }
  if (type === "milestone" || type === "results") {
    extra.push(
      { id: "results", label: type === "results" ? "Your results after 26 weeks, on the scale and off it" : "What results have you had so far? On the scale, and off it (sleep, energy, clothes, bloodwork, mood)", kind: "text", video: true },
      { id: "advice", label: "What would you tell a woman who's on the fence about joining?", kind: "text", video: true },
      { id: "share", label: "Can I share your story?", kind: "choice", options: ["Yes, with my name", "Yes, without my name", "No"] },
    );
  }
  if (type === "halfway") {
    extra.push(
      { id: "confidence", label: "How confident are you that you'd keep all this going on your own after Week 26?", kind: "scale" },
      { id: "second_half", label: "What do you want help with in the second half?", kind: "text" },
    );
  }
  if (type === "last_chance") {
    extra.push({ id: "next_6_months", label: "What do you want the next 6 months to look like?", kind: "text" });
    if (!opts.onFullYear) {
      extra.push({ id: "after_26", label: "After Week 26, which feels right?", kind: "choice",
        options: ["I want to keep going with Michael", "I'd like to talk about it", "I'm ready to go on my own"] });
    }
  }

  return [
    ...q,
    ...extra,
    { id: "win", label: "Your biggest win this week", kind: "text", video: true },
    { id: "help", label: "One thing you want help with, or want to do better", kind: "text", video: true },
    { id: "else", label: "Anything else for Michael?", kind: "text", optional: true, video: true },
  ];
}

const PRO_WORDS = /\b(pain|hurts?|injur\w*|dizz\w*|faint\w*|chest|pregnan\w*|bleed\w*|depress\w*|panic|doctor|medication|meds|surgery|numb\w*|snor\w*)\b/i;

/** Flags for Michael's dashboard. */
export function flagsFor(now: Record<string, unknown>, last: { sleep?: number | null; energy?: number | null } | null): string[] {
  const f: string[] = [];
  const n = (k: string) => Number(now[k] ?? 0);
  if (n("hunger") >= 8) f.push("Hunger 8+");
  if (last?.sleep && n("sleep") && n("sleep") <= last.sleep - 2) f.push("Sleep dropping");
  if (last?.energy && n("energy") && n("energy") <= last.energy - 2) f.push("Energy dropping");
  if (n("stress") >= 8) f.push("Stress 8+");
  const text = Object.values(now).filter((v) => typeof v === "string").join(" ");
  const m = text.match(PRO_WORDS);
  if (m) f.push(`Mentions "${m[0].toLowerCase()}"`);
  if (now.sleep_vs_before === "The same" || now.sleep_vs_before === "Worse") f.push("Sleep Better Guarantee: check");
  if (now.after_26 && now.after_26 !== "I'm ready to go on my own") f.push("Renewal: wants to talk");
  return f;
}

/** Every question's label by id, for showing old answers and building the AI context. */
export function questionLabels(): Record<string, string> {
  const weeks: [number, Week][] = [
    [1, { checkin_type: "week1", checkin_is_video: false, is_diet_break: false, moments: [] }],
    [4, { checkin_type: "four_week", checkin_is_video: true, is_diet_break: true, moments: ["sleep_better_checkpoint"] }],
    [12, { checkin_type: "milestone", checkin_is_video: true, is_diet_break: false, moments: [] }],
    [13, { checkin_type: "halfway", checkin_is_video: false, is_diet_break: false, moments: [] }],
    [24, { checkin_type: "last_chance", checkin_is_video: false, is_diet_break: true, moments: [] }],
  ];
  return { ...Object.fromEntries(weeks.flatMap(([w, t]) => questionsFor(w, t)).map((q) => [q.id, q.label])), sleep_hours: "Hours of sleep a night", steps_avg: "Average steps a day" };
}
