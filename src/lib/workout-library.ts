import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gearFor } from "./equipment";

export type LibWorkout = { id: number; name: string; kind: string; minutes: number | null; exercises: number; gear: string[]; programs: string[] };

let cache: { at: number; list: LibWorkout[] } | null = null;

/** Every workout in the app with the gear it needs, built once an hour (workouts only change when Michael imports). */
export async function workoutLibrary(supabase: SupabaseClient): Promise<LibWorkout[]> {
  if (cache && Date.now() - cache.at < 3_600_000) return cache.list;
  const page = async <T,>(f: (a: number, b: number) => PromiseLike<{ data: unknown }>) => {
    const out: T[] = [];
    for (let a = 0; a < 100000; a += 1000) { const { data } = await f(a, a + 999); const d = (data ?? []) as T[]; out.push(...d); if (d.length < 1000) break; }
    return out;
  };
  const [workouts, items, links, phases, programs] = await Promise.all([
    page<{ id: number; name: string; kind: string; minutes: number | null }>((a, b) => supabase.from("workouts").select("id, name, kind, minutes").order("id").range(a, b)),
    page<{ workout_id: number; exercises: { name: string } | null }>((a, b) => supabase.from("workout_items").select("workout_id, exercises(name)").order("workout_id").order("position").range(a, b)),
    page<{ phase_id: number; workout_id: number }>((a, b) => supabase.from("phase_workouts").select("phase_id, workout_id").order("phase_id").range(a, b)),
    page<{ id: number; program: string }>((a, b) => supabase.from("program_phases").select("id, program").order("id").range(a, b)),
    page<{ id: string; name: string; active: boolean }>((a, b) => supabase.from("programs").select("id, name, active").order("id").range(a, b)),
  ]);
  const names = new Map<number, string[]>();
  for (const i of items) { if (!i.exercises) continue; const l = names.get(i.workout_id) ?? []; l.push(i.exercises.name); names.set(i.workout_id, l); }
  const progOfPhase = new Map(phases.map((p) => [p.id, p.program]));
  const progName = new Map(programs.map((p) => [p.id, p.name]));
  const inPrograms = new Map<number, Set<string>>();
  for (const l of links) { const p = progOfPhase.get(l.phase_id); if (!p) continue; const s = inPrograms.get(l.workout_id) ?? new Set(); s.add(p); inPrograms.set(l.workout_id, s); }
  const list = workouts.filter((w) => (names.get(w.id) ?? []).length >= 2 && inPrograms.has(w.id)).map((w) => ({
    id: w.id, name: w.name, kind: w.kind, minutes: w.minutes, exercises: (names.get(w.id) ?? []).length,
    gear: gearFor(names.get(w.id) ?? [], w.name), programs: [...(inPrograms.get(w.id) ?? [])].map((p) => progName.get(p) ?? p),
  }));
  cache = { at: Date.now(), list };
  return list;
}
