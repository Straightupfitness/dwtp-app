"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadWorkoutWeek } from "@/lib/workouts";

/**
 * November 15 (Claudia trains at another gym): Michael builds a custom workout program for one client. It's an
 * ordinary program in the app (one long phase, Day 1–N workouts, the usual cardio menu), so the Workouts tab, the
 * Player, her calendar and history all work as before.
 */
export type ItemInput = { exercise_id: number; sets: number; target: string; rest_seconds: number | null; log_type: string };

async function coach() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return me?.role === "coach" ? supabase : null;
}
let seq = 0;
const newId = () => Date.now() * 1000 + ((seq++ % 900) + Math.floor(Math.random() * 100));
const LOG_TYPES = ["strength", "endurance", "timedStrength", "timedLongerBetter", "general", "rest"];

export async function createCustomProgram(clientId: string, days: number, copyCurrent: boolean) {
  const db = await coach();
  if (!db) return { error: "Coach only" };
  const n = Math.min(6, Math.max(1, Math.round(days)));
  const { data: p } = await db.from("profiles").select("full_name").eq("id", clientId).single();
  const first = ((p?.full_name as string | null) ?? "Client").split(" ")[0];
  // Her current week (or Week 1 before she starts): to copy from, and her cardio menu.
  let now = await loadWorkoutWeek(db, clientId).catch(() => null);
  if (!now?.phase) now = await loadWorkoutWeek(db, clientId, Math.max(1, now?.current ?? 1)).catch(() => null);

  const progId = `custom-${clientId.slice(0, 8)}-${Date.now().toString(36)}`;
  const { error: e1 } = await db.from("programs").insert({ id: progId, name: `${first}'s custom program`, description: "Built by Michael for one client.", weeks: 52, sort: 900, active: false });
  if (e1) return { error: e1.message };
  const phaseId = newId();
  const { error: e2 } = await db.from("program_phases").insert({ id: phaseId, program: progId, position: 1, name: "Custom program", stage: "DWTP", kind: "build", weeks: 52, first_week: 1 });
  if (e2) return { error: e2.message };

  for (let d = 1; d <= n; d++) {
    const src = copyCurrent ? now?.strength.find((s) => s.day === d) ?? now?.strength[d - 1] : undefined;
    const wid = newId();
    const { error } = await db.from("workouts").insert({ id: wid, name: src?.name ?? `Day ${d}`, kind: "strength", circuit: false, minutes: src?.minutes ?? null });
    if (error) return { error: error.message };
    if (src) {
      const { data: items } = await db.from("workout_items").select("position, exercise_id, sets, target, seconds, rest_seconds, log_type").eq("workout_id", src.id);
      if (items?.length) await db.from("workout_items").insert(items.map((i) => ({ ...i, workout_id: wid })));
    }
    await db.from("phase_workouts").insert({ phase_id: phaseId, workout_id: wid, day: d });
  }
  // Her usual cardio menu comes along (the same cardio workouts, not copies).
  for (const c of now?.cardio ?? []) await db.from("phase_workouts").insert({ phase_id: phaseId, workout_id: c.id, day: null });

  await db.from("profiles").update({ workout_program: progId, workout_start_week: 1, strength_days_per_week: n }).eq("id", clientId);
  revalidatePath(`/coach/clients/${clientId}`, "layout");
  return { ok: true };
}

export async function saveDay(clientId: string, workoutId: number, name: string, items: ItemInput[]) {
  const db = await coach();
  if (!db) return { error: "Coach only" };
  if (!name.trim()) return { error: "Give the workout a name." };
  const { error: e1 } = await db.from("workouts").update({ name: name.trim().slice(0, 120) }).eq("id", workoutId);
  if (e1) return { error: e1.message };
  await db.from("workout_items").delete().eq("workout_id", workoutId);
  const rows = items.filter((i) => i.exercise_id).map((i, k) => ({
    workout_id: workoutId, position: k + 1, exercise_id: i.exercise_id, sets: Math.min(20, Math.max(1, Math.round(i.sets || 1))),
    target: i.target.trim() || null, rest_seconds: i.rest_seconds ?? null, seconds: null, log_type: LOG_TYPES.includes(i.log_type) ? i.log_type : "strength",
  }));
  if (rows.length) { const { error } = await db.from("workout_items").insert(rows); if (error) return { error: error.message }; }
  revalidatePath(`/coach/clients/${clientId}/program`);
  return { ok: true };
}

export async function addDay(clientId: string, phaseId: number) {
  const db = await coach();
  if (!db) return { error: "Coach only" };
  const { data: links } = await db.from("phase_workouts").select("day").eq("phase_id", phaseId).not("day", "is", null);
  const d = Math.max(0, ...(links ?? []).map((l) => l.day as number)) + 1;
  if (d > 6) return { error: "Six workout days is the most." };
  const wid = newId();
  await db.from("workouts").insert({ id: wid, name: `Day ${d}`, kind: "strength", circuit: false });
  await db.from("phase_workouts").insert({ phase_id: phaseId, workout_id: wid, day: d });
  await db.from("profiles").update({ strength_days_per_week: d }).eq("id", clientId);
  revalidatePath(`/coach/clients/${clientId}/program`);
  return { ok: true };
}

/** Removes the last day (so days stay 1, 2, 3…). Workouts she already did stay in her history. */
export async function removeLastDay(clientId: string, phaseId: number) {
  const db = await coach();
  if (!db) return { error: "Coach only" };
  const { data: links } = await db.from("phase_workouts").select("day, workout_id").eq("phase_id", phaseId).not("day", "is", null).order("day", { ascending: false });
  if (!links?.length || links.length === 1) return { error: "Keep at least one day." };
  await db.from("phase_workouts").delete().eq("phase_id", phaseId).eq("workout_id", links[0].workout_id);
  await db.from("profiles").update({ strength_days_per_week: links.length - 1 }).eq("id", clientId);
  revalidatePath(`/coach/clients/${clientId}/program`);
  return { ok: true };
}

export async function searchExercises(q: string) {
  const db = await coach();
  if (!db || q.trim().length < 2) return [];
  const words = q.trim().split(/\s+/).slice(0, 4);
  let query = db.from("exercises").select("id, name, clip_path, youtube_id").order("name").limit(25);
  for (const w of words) query = query.ilike("name", `%${w.replace(/[%_]/g, "")}%`);
  const { data } = await query;
  return (data ?? []).map((e) => ({ id: e.id as number, name: e.name as string, video: !!(e.clip_path || e.youtube_id) }));
}

/** A new exercise for the library (name, how-to, optional YouTube link). */
export async function addExercise(name: string, notes: string, youtube: string) {
  const db = await coach();
  if (!db) return { error: "Coach only" };
  if (!name.trim()) return { error: "Name the exercise." };
  const yt = youtube.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/)?.[1] ?? (/^[\w-]{11}$/.test(youtube.trim()) ? youtube.trim() : null);
  const id = newId();
  const { error } = await db.from("exercises").insert({ id, name: name.trim().slice(0, 120), notes: notes.trim() || null, youtube_id: yt });
  if (error) return { error: error.message };
  return { ok: true, exercise: { id, name: name.trim(), video: !!yt } };
}

export async function assignProgram(clientId: string, programId: string, days?: number) {
  const db = await coach();
  if (!db) return { error: "Coach only" };
  const { error } = await db.from("profiles").update({ workout_program: programId, ...(days ? { strength_days_per_week: days } : {}) }).eq("id", clientId);
  if (error) return { error: error.message };
  revalidatePath(`/coach/clients/${clientId}`, "layout");
  return { ok: true };
}
