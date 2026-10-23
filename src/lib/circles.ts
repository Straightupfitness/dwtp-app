/**
 * Capacity Circles: which rings are open for her today, and how far along each habit is.
 * Rules (doc 23 and the October 23 decisions):
 * - Focus circles (her 3, or a circle Michael opened early): ring 1 opens on her start date (or its plan
 *   week, if later), and the next ring opens once she's halfway through the current one ("day 8" of its
 *   14-day streak) or when her plan reaches it, whichever is first. Circadian Reset ring 2 opens with ring 1.
 * - Every other circle only opens a ring when her 26-week plan reaches it.
 * - A habit that lives in two circles (habit_key) shares its logs, so credit carries over,
 *   even into a circle that hasn't opened yet. Progress there starts when the circle opens.
 * - "Weigh in daily" and "log every meal" check themselves off from her weight and food logs.
 * - Daily habits: 14-day streak. Weekly habits: 2 weeks in a row. Get / Learn: once.
 *   Hit: Michael signs it off.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { STREAK_DAYS, STREAK_WEEKS, dailyStreak, programWeek, todayIn } from "./program";

export const DEFAULT_FOCUS = ["circadian-reset", "food-philosophy", "cardio"];
/** Habits the app checks off by itself, and what it says instead of a checkbox. */
export const AUTO_HABITS: Record<string, string> = {
  "weigh-in": "Checks itself off when you log your weight",
  "log-food": "Checks itself off when you log a meal",
};

/**
 * One color per circle (decided October 23): every medal in a circle shares it.
 * Fix-its are a neutral silver so they look different from the growth circles.
 * (In the database a medal is still a "ring".)
 */
export const CIRCLE_COLORS: Record<string, string> = {
  "circadian-reset": "#818cf8", "food-quality": "#22c55e", "food-philosophy": "#f97316", kitchen: "#ef4444",
  supplements: "#2dd4bf", strength: "#f5a623", cardio: "#fb7185", mobility: "#38bdf8", mindset: "#c084fc",
  "healthy-home": "#a3e635", "role-model": "#facc15",
};
export const FIXIT_COLOR = "#cbd5e1";
export function circleColor(slug: string): string {
  return CIRCLE_COLORS[slug] ?? FIXIT_COLOR;
}

export type ItemState = {
  id: string; title: string; detail: string | null; type: string; cadence: string; habitKey: string | null;
  complete: boolean;
  doneNow: boolean;       // daily: done today · weekly: done this week · once: done
  progress: number;       // days (daily) or weeks (weekly) toward the target
  target: number;
  alsoIn: string[];       // other circles this habit counts in
  auto: string | null;    // AUTO_HABITS note, when the app checks it off by itself
};
export type RingState = {
  id: string; number: number; name: string; outcome: string | null; cps: number; color: string;
  status: "complete" | "open" | "upcoming" | "locked";
  opensOn: string | null; // date it opens (upcoming) or opened (open)
  halfwayOf: number | null; // upcoming: opens once she's halfway through this ring
  planWeek: number | null;
  saved: boolean;         // has a client_rings row
  day: number;            // day of the ring since it opened (open rings)
  fraction: number;       // 0–1, for the target drawing
  items: ItemState[];
};
export type CircleState = {
  id: string; slug: string; name: string; kind: string; goal: string | null; seeAPro: string | null; sort: number;
  color: string;
  focus: boolean; workAhead: boolean;
  status: "open" | "upcoming" | "locked";
  firstPlanWeek: number | null;
  rings: RingState[];
  ringsComplete: number;
  current: RingState | null;  // the innermost open ring
};
export type ProgramState = {
  today: string; week: number; programStart: string | null;
  circles: CircleState[];
};

const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const minDate = (...ds: (string | null | undefined)[]) => (ds.filter(Boolean) as string[]).sort()[0] ?? null;

function maxRun(sorted: number[]): number {
  let best = 0, run = 0;
  for (let i = 0; i < sorted.length; i++) {
    run = i > 0 && sorted[i] === sorted[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

/** Fetch every row, 1,000 at a time (Supabase caps a single response). */
async function all<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await q(from, from + 999);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

type Row = Record<string, unknown>;

export async function loadProgram(supabase: SupabaseClient, userId: string): Promise<ProgramState> {
  const { data: profile } = await supabase.from("profiles").select("timezone, program_start").eq("id", userId).single();
  const today = todayIn(profile?.timezone ?? "America/Los_Angeles");
  const P: string | null = profile?.program_start ?? null;
  const week = programWeek(P, today);

  const tz = profile?.timezone ?? "America/Los_Angeles";
  const [circles, rings, items, traj, focusRows, clientRings, clientItems, logs, weights, meals] = await Promise.all([
    all<Row>((a, b) => supabase.from("circles").select("id, slug, name, kind, goal, see_a_professional, sort").order("sort").range(a, b)),
    all<Row>((a, b) => supabase.from("rings").select("id, circle_id, ring_number, name, outcome, cps").order("ring_number").range(a, b)),
    all<Row>((a, b) => supabase.from("ring_items").select("id, ring_id, item_type, cadence, title, detail, habit_key, sort").order("sort").range(a, b)),
    all<Row>((a, b) => supabase.from("trajectory_week_rings").select("week_number, ring_id").range(a, b)),
    all<Row>((a, b) => supabase.from("client_focus_circles").select("circle_id").eq("client_id", userId).range(a, b)),
    all<Row>((a, b) => supabase.from("client_rings").select("ring_id, status, opened_on, opened_early").eq("client_id", userId).range(a, b)),
    all<Row>((a, b) => supabase.from("client_items").select("item_id, completed_on").eq("client_id", userId).range(a, b)),
    all<Row>((a, b) => supabase.from("habit_logs").select("item_id, log_date").eq("client_id", userId).order("log_date").range(a, b)),
    all<Row>((a, b) => supabase.from("weight_logs").select("log_date").eq("client_id", userId).range(a, b)),
    all<Row>((a, b) => supabase.from("food_logs").select("eaten_at").eq("client_id", userId).range(a, b)),
  ]);
  const autoDates: Record<string, Set<string>> = {
    "weigh-in": new Set(weights.map((w) => w.log_date as string)),
    "log-food": new Set(meals.map((m) => todayIn(tz, new Date(m.eaten_at as string)))),
  };

  const focusIds = new Set(focusRows.length
    ? focusRows.map((r) => r.circle_id as string)
    : circles.filter((c) => DEFAULT_FOCUS.includes(c.slug as string)).map((c) => c.id as string));
  const planWeekOf = new Map<string, number>();
  traj.forEach((t) => {
    const w = t.week_number as number, id = t.ring_id as string;
    if (!planWeekOf.has(id) || w < planWeekOf.get(id)!) planWeekOf.set(id, w);
  });
  const cr = new Map(clientRings.map((r) => [r.ring_id as string, r]));
  const ciDone = new Map(clientItems.filter((r) => r.completed_on).map((r) => [r.item_id as string, r.completed_on as string]));
  const logsBy = new Map<string, Set<string>>();
  logs.forEach((l) => {
    const id = l.item_id as string;
    if (!logsBy.has(id)) logsBy.set(id, new Set());
    logsBy.get(id)!.add(l.log_date as string);
  });
  const ringById = new Map(rings.map((r) => [r.id as string, r]));
  const circleById = new Map(circles.map((c) => [c.id as string, c]));
  const circlesOfKey = new Map<string, Set<string>>();
  items.forEach((i) => {
    if (!i.habit_key) return;
    const circleName = circleById.get(ringById.get(i.ring_id as string)?.circle_id as string)?.name as string;
    if (!circlesOfKey.has(i.habit_key as string)) circlesOfKey.set(i.habit_key as string, new Set());
    circlesOfKey.get(i.habit_key as string)!.add(circleName);
  });
  const weekIdx = (d: string) => (P ? Math.floor(daysBetween(P, d) / 7) : 0);
  const thisWeek = weekIdx(today);

  function itemState(i: Row, circleName: string): ItemState {
    const id = i.id as string, cadence = i.cadence as string, type = i.item_type as string;
    const key = (i.habit_key as string) ?? null;
    const dates = key && autoDates[key] ? autoDates[key] : logsBy.get(id) ?? new Set<string>();
    const base = {
      auto: key ? AUTO_HABITS[key] ?? null : null,
      id, title: i.title as string, detail: (i.detail as string) ?? null, type, cadence, habitKey: (i.habit_key as string) ?? null,
      alsoIn: i.habit_key ? [...(circlesOfKey.get(i.habit_key as string) ?? [])].filter((n) => n !== circleName) : [],
    };
    if (type === "hit") return { ...base, complete: ciDone.has(id), doneNow: ciDone.has(id), progress: ciDone.has(id) ? 1 : 0, target: 1 };
    if (cadence === "once") {
      const done = ciDone.has(id) || dates.size > 0;
      return { ...base, complete: done, doneNow: done, progress: done ? 1 : 0, target: 1 };
    }
    if (cadence === "weekly") {
      const weeks = [...new Set([...dates].map(weekIdx))].sort((a, b) => a - b);
      const set = new Set(weeks);
      let run = 0;
      for (let w = set.has(thisWeek) ? thisWeek : thisWeek - 1; set.has(w); w--) run++;
      const complete = ciDone.has(id) || maxRun(weeks) >= STREAK_WEEKS;
      return { ...base, complete, doneNow: set.has(thisWeek), progress: complete ? STREAK_WEEKS : run, target: STREAK_WEEKS };
    }
    const days = [...dates].map((d) => daysBetween("2000-01-01", d)).sort((a, b) => a - b);
    const complete = ciDone.has(id) || maxRun(days) >= STREAK_DAYS;
    return { ...base, complete, doneNow: dates.has(today), progress: complete ? STREAK_DAYS : dailyStreak(dates, today), target: STREAK_DAYS };
  }

  const out: CircleState[] = circles.map((c) => {
    const id = c.id as string, slug = c.slug as string, name = c.name as string;
    const crs = rings.filter((r) => r.circle_id === id).sort((a, b) => (a.ring_number as number) - (b.ring_number as number));
    const focus = focusIds.has(id);
    const workAhead = focus || crs.some((r) => cr.get(r.id as string)?.opened_early);
    let prev: RingState | null = null;

    const ringStates: RingState[] = [];
    for (const r of crs) {
      const rid = r.id as string, n = r.ring_number as number;
      const planWeek = planWeekOf.get(rid) ?? null;
      const planDate = P && planWeek ? addDays(P, (planWeek - 1) * 7) : null;
      const row = cr.get(rid);
      const saved = (row?.opened_on as string) ?? null;
      let opensOn: string | null = null, halfwayOf: number | null = null;
      if (P) {
        if (!workAhead) opensOn = minDate(planDate, saved);
        else if (n === 1) opensOn = minDate(planDate ?? (focus ? P : null), saved);
        else {
          const prevOn = prev && (prev.status === "open" || prev.status === "complete");
          let chain: string | null = null;
          if (prevOn && slug === "circadian-reset" && n === 2) chain = prev!.opensOn;
          else if (prevOn && (prev!.status === "complete" || prev!.fraction >= 0.5)) chain = today;
          else if (prevOn) halfwayOf = prev!.number;
          opensOn = minDate(chain, planDate, saved);
        }
      }
      const its = items.filter((i) => i.ring_id === rid).map((i) => itemState(i, name));
      const status: RingState["status"] = row?.status === "complete" ? "complete"
        : opensOn && opensOn <= today ? "open" : opensOn || halfwayOf ? "upcoming" : "locked";
      if (status === "open" || status === "complete") halfwayOf = null;
      const parts = its.map((i) => (i.complete ? 1 : Math.min(1, i.progress / i.target)));
      const fraction = status === "complete" ? 1 : status === "open" && parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
      const ring: RingState = {
        id: rid, number: n, name: r.name as string, outcome: (r.outcome as string) ?? null, cps: (r.cps as number) ?? 50,
        color: circleColor(slug), status, opensOn, halfwayOf, planWeek, saved: !!row,
        day: status === "open" && opensOn ? daysBetween(opensOn, today) + 1 : 0, fraction, items: its,
      };
      ringStates.push(ring);
      prev = ring;
    }

    const anyOpen = ringStates.some((r) => r.status === "open" || r.status === "complete");
    const anyUpcoming = ringStates.some((r) => r.status === "upcoming");
    const weeks = ringStates.map((r) => r.planWeek).filter((w): w is number => w !== null);
    return {
      id, slug, name, kind: c.kind as string, goal: (c.goal as string) ?? null, seeAPro: (c.see_a_professional as string) ?? null,
      sort: c.sort as number, color: circleColor(slug), focus, workAhead,
      status: anyOpen ? "open" : anyUpcoming ? "upcoming" : "locked",
      firstPlanWeek: weeks.length ? Math.min(...weeks) : null,
      rings: ringStates,
      ringsComplete: ringStates.filter((r) => r.status === "complete").length,
      current: ringStates.find((r) => r.status === "open") ?? null,
    };
  });

  return { today, week, programStart: P, circles: out };
}

/** Days until a date, for "Opens in 6 days". */
export function daysUntil(today: string, date: string) {
  return daysBetween(today, date);
}
