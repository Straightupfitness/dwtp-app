/**
 * Workouts (decided October 28): the Strong Life Transformation Program from Trainerize, 63 weeks in 30 phases,
 * is everyone's program ('sltp'). Michael can put a client on one of his other Trainerize programs (Edit details).
 * - Her program week (Week 1 = her start Monday) picks the phase. Every client runs the whole program.
 * - Strength: 1x clients get Day 1, 2x get Days 1–2, everyone else every day of the phase (3 or 4).
 * - Cardio: every phase offers the full menu (the song-named circuits and Hill Sprints).
 * - Exercise videos: Michael's YouTube, or the clips saved from Trainerize in the public exercise-clips bucket.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./supabase/config";
import { programWeek, todayIn } from "./program";

export type Phase = { id: number; name: string; stage: string; kind: "build" | "deload" | "pivot" | "max"; weeks: number; first_week: number };
export type WorkoutCard = {
  id: number; name: string; title: string; day: number | null; minutes: number | null; exercises: number;
  poster: string | null; done: boolean; started: boolean; kind: "strength" | "cardio"; circuit: boolean;
};
export type Exercise = { id: number; name: string; notes: string | null; youtube_id: string | null; clip_path: string | null };
export type Item = { position: number; sets: number; target: string | null; seconds: number | null; rest_seconds: number | null; log_type: string; exercise: Exercise };

/** The four stages, as Michael's Trainerize phases are named (labels can be renamed here). */
export const STAGES: Record<string, { label: string; color: string; tint: string }> = {
  DWTP: { label: "Driven Woman", color: "#f5a623", tint: "#2a1d07" },
  SLTP: { label: "Strong Life", color: "#fb7185", tint: "#2b1218" },
  PSR: { label: "Photo Shoot Ready", color: "#38bdf8", tint: "#0b2230" },
  SLF: { label: "Strong Life Forever", color: "#a3e635", tint: "#1b260a" },
};
/** The chip on a phase: the four stages of the main program, or the program's own name. */
export function stageOf(stage: string, programName: string) {
  return STAGES[stage] ?? { label: programName, color: "#f5a623", tint: "#2a1d07" };
}
/** "DWTP Phase 2" → "Phase 2"; other programs' phase names stay as they are ("Week 1 - 4"). */
export function phaseLabel(name: string, stage: string) {
  return STAGES[stage] && name.startsWith(stage + " ") ? name.slice(stage.length + 1) : name;
}
export const KIND_LABEL: Record<Phase["kind"], string> = { build: "Build week", deload: "Deload week", pivot: "Pivot week", max: "Max out week" };
export const KIND_NOTE: Record<Phase["kind"], string> = {
  build: "Same workouts all phase. Beat last week's numbers.",
  deload: "Lighter week on purpose. Move well, recover, come back stronger.",
  pivot: "Something different this week to reset before the next phase.",
  max: "Test week. Go for your best numbers.",
};

const base = () => `${supabaseUrl()}/storage/v1/object/public/exercise-clips`;
export const clipUrl = (e: Pick<Exercise, "clip_path">) => (e.clip_path ? `${base()}/${e.clip_path}.mp4` : null);
export const posterUrl = (e: Pick<Exercise, "clip_path" | "youtube_id">) =>
  e.clip_path ? `${base()}/${e.clip_path}.jpg` : e.youtube_id ? `https://i.ytimg.com/vi/${e.youtube_id}/mqdefault.jpg` : null;

/** "DWTP Phase 2 Day 3" → "Day 3"; "KB Cardio - Iron Man" → "Iron Man". */
export function workoutTitle(name: string) {
  const day = name.match(/Day\s*0*(\d+[a-d]?)$/i);
  if (day) return `Day ${day[1]}`;
  return name.replace(/^.*?Cardio\s*-\s*/i, "").replace(/^Cardio\s*-\s*/i, "");
}
/** "KB Cardio - Iron Man" → "Kettlebell". */
export function cardioType(name: string) {
  const t = name.match(/^(\w+)\s+Cardio/i)?.[1]?.toLowerCase();
  return t === "kb" ? "Kettlebell" : t === "bb" || t === "barbell" ? "Barbell" : t === "rope" ? "Jump rope" : t === "bike" ? "Bike" : "Sprints";
}

export function daysFor(perWeek: number | null, available: number[]) {
  const days = [...available].sort((a, b) => a - b);
  return perWeek === 1 ? days.slice(0, 1) : perWeek === 2 ? days.slice(0, 2) : days;
}

/** Her week: the phase, this week's strength days (with done/started), and the cardio menu. */
export async function loadWorkoutWeek(supabase: SupabaseClient, clientId: string, weekOverride?: number) {
  const { data: p } = await supabase.from("profiles").select("program_start, timezone, strength_days_per_week, workout_program, workout_start_week").eq("id", clientId).single();
  const today = todayIn(p?.timezone ?? "America/Los_Angeles");
  const current = programWeek(p?.program_start ?? null, today);
  const week = weekOverride ?? current;                         // her program week (sessions are saved by this)
  const programId = (p?.workout_program as string | null) ?? "sltp";
  const offset = Math.max(0, ((p?.workout_start_week as number | null) ?? 1) - 1); // "start her at week N" of her workout program
  const pweek = week >= 1 ? week + offset : week;               // the week of her workout program
  const [{ data: phases }, { data: prog }] = await Promise.all([
    supabase.from("program_phases").select("id, name, stage, kind, weeks, first_week").eq("program", programId).order("position"),
    supabase.from("programs").select("id, name").eq("id", programId).maybeSingle(),
  ]);
  const all = (phases ?? []) as Phase[];
  const totalWeeks = all.reduce((n, x) => n + x.weeks, 0);
  const program = { id: programId, name: (prog?.name as string | undefined) ?? "Your program" };
  const phase = pweek >= 1 ? all.find((x) => pweek >= x.first_week && pweek < x.first_week + x.weeks) ?? null : null;
  if (!phase) return { today, week, pweek, current, totalWeeks, program, phases: all, phase: null, weekOfPhase: 0, strength: [] as WorkoutCard[], cardio: [] as WorkoutCard[], nextUp: null as WorkoutCard | null, start: p?.program_start ?? null };

  const { data: links } = await supabase.from("phase_workouts")
    .select("day, from_week, to_week, workouts(id, name, kind, circuit, minutes, workout_items(position, exercises(clip_path, youtube_id, name)))").eq("phase_id", phase.id);
  type W = { id: number; name: string; kind: "strength" | "cardio"; circuit: boolean; minutes: number | null; workout_items: { position: number; exercises: { clip_path: string | null; youtube_id: string | null; name: string } | null }[] };
  const wop = pweek - phase.first_week + 1;
  // Some programs run different workouts in different weeks of a phase (13 Hard & Resilient, "Day 1a / 1b").
  const rows = ((links ?? []) as unknown as { day: number | null; from_week: number | null; to_week: number | null; workouts: W | null }[])
    .filter((l) => l.workouts && (l.from_week ?? 1) <= wop && wop <= (l.to_week ?? 99));
  const ids = rows.map((r) => r.workouts!.id);
  const { data: sessions } = ids.length
    ? await supabase.from("workout_sessions").select("workout_id, completed_at").eq("client_id", clientId).eq("program_week", week).in("workout_id", ids)
    : { data: [] };
  const sess = new Map((sessions ?? []).map((s) => [s.workout_id as number, s.completed_at as string | null]));

  const card = (r: { day: number | null; workouts: W | null }): WorkoutCard => {
    const w = r.workouts!;
    const items = [...w.workout_items].sort((a, b) => a.position - b.position);
    // The poster: the first exercise clip after the overview and mobility videos.
    const visual = items.find((i) => i.exercises?.clip_path) ?? items.find((i) => i.exercises?.youtube_id);
    return {
      id: w.id, name: w.name, title: workoutTitle(w.name), day: r.day, minutes: w.minutes, exercises: items.length,
      poster: visual?.exercises ? posterUrl(visual.exercises) : null, done: !!sess.get(w.id), started: sess.has(w.id) && !sess.get(w.id),
      kind: w.kind, circuit: w.circuit,
    };
  };
  const allDays = rows.filter((r) => r.workouts!.kind === "strength" && r.day).map((r) => r.day!) ;
  const mine = new Set(daysFor(p?.strength_days_per_week ?? null, [...new Set(allDays)]));
  const strength = rows.filter((r) => r.workouts!.kind === "strength" && r.day && mine.has(r.day)).map(card).sort((a, b) => (a.day ?? 0) - (b.day ?? 0));
  // Trainerize had a copy of Hill Sprints in every phase: show each cardio workout once (by name, always the same copy).
  const seen = new Set<string>();
  const cardio = [...rows].sort((a, b) => a.workouts!.id - b.workouts!.id).filter((r) => r.workouts!.kind === "cardio" && !seen.has(r.workouts!.name.trim().toLowerCase()) && !!seen.add(r.workouts!.name.trim().toLowerCase())).map(card)
    .sort((a, b) => (a.name.startsWith("Cardio - Hill") ? -1 : b.name.startsWith("Cardio - Hill") ? 1 : a.name.localeCompare(b.name)));
  return {
    today, week, pweek, current, totalWeeks, program, phases: all, phase, weekOfPhase: wop, strength, cardio,
    nextUp: strength.find((s) => !s.done) ?? null, start: p?.program_start ?? null,
  };
}

/** What she lifted last time for each exercise (any workout), newest first: set number → numbers. */
export async function lastNumbers(supabase: SupabaseClient, clientId: string, exerciseIds: number[], excludeSession?: string) {
  if (!exerciseIds.length) return new Map<number, { when: string; sets: { set_no: number; weight: number | null; reps: number | null; seconds: number | null; note: string | null }[] }>();
  let q = supabase.from("set_logs").select("session_id, exercise_id, set_no, weight, reps, seconds, note, logged_at")
    .eq("client_id", clientId).in("exercise_id", exerciseIds).order("logged_at", { ascending: false }).limit(600);
  if (excludeSession) q = q.neq("session_id", excludeSession);
  const { data } = await q;
  const out = new Map<number, { session: string; when: string; sets: { set_no: number; weight: number | null; reps: number | null; seconds: number | null; note: string | null }[] }>();
  for (const r of data ?? []) {
    const ex = r.exercise_id as number;
    const cur = out.get(ex);
    if (!cur) out.set(ex, { session: r.session_id as string, when: r.logged_at as string, sets: [] });
    const row = out.get(ex)!;
    if (row.session === r.session_id) row.sets.push({ set_no: r.set_no as number, weight: r.weight as number | null, reps: r.reps as number | null, seconds: r.seconds as number | null, note: r.note as string | null });
  }
  for (const v of out.values()) v.sets.sort((a, b) => a.set_no - b.set_no);
  return out as Map<number, { when: string; sets: { set_no: number; weight: number | null; reps: number | null; seconds: number | null; note: string | null }[] }>;
}

/** How each kind of exercise is logged. */
export function logFields(logType: string): ("weight" | "reps" | "seconds" | "note")[] {
  switch (logType) {
    case "strength": return ["weight", "reps"];
    case "endurance": return ["reps"];
    case "timedStrength": return ["weight", "note"];
    case "timedLongerBetter": case "timedFasterBetter": case "cardio": return ["seconds"];
    default: return [];
  }
}
