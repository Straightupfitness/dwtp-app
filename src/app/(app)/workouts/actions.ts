"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { programWeek, todayIn } from "@/lib/program";
import { closeOutRings } from "@/lib/progress";

const WORKOUT_CPS = 5;

async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Opens (or reopens) this week's session for a workout, so every set she logs is saved as she goes. */
export async function startSession(workoutId: number) {
  const { supabase, user } = await me();
  if (!user) return { error: "Not signed in" };
  const { data: p } = await supabase.from("profiles").select("program_start, timezone").eq("id", user.id).single();
  const week = programWeek(p?.program_start ?? null, todayIn(p?.timezone ?? "America/Los_Angeles"));
  const { data: existing } = await supabase.from("workout_sessions").select("id, completed_at")
    .eq("client_id", user.id).eq("workout_id", workoutId).eq("program_week", week).maybeSingle();
  if (existing) return { id: existing.id as string, completed: !!existing.completed_at };
  const { data, error } = await supabase.from("workout_sessions").insert({ client_id: user.id, workout_id: workoutId, program_week: week }).select("id").single();
  if (error) return { error: error.message };
  return { id: data.id as string, completed: false };
}

export async function logSet(sessionId: string, position: number, setNo: number, exerciseId: number,
  v: { weight?: number | null; reps?: number | null; seconds?: number | null; note?: string | null; done: boolean }) {
  const { supabase, user } = await me();
  if (!user) return { error: "Not signed in" };
  if (!v.done) {
    await supabase.from("set_logs").delete().eq("session_id", sessionId).eq("position", position).eq("set_no", setNo).eq("client_id", user.id);
    return { ok: true };
  }
  const num = (x: number | null | undefined) => (x === null || x === undefined || !isFinite(x) ? null : x);
  const { error } = await supabase.from("set_logs").upsert({
    session_id: sessionId, client_id: user.id, position, set_no: setNo, exercise_id: exerciseId,
    weight: num(v.weight), reps: num(v.reps) === null ? null : Math.round(v.reps!), seconds: num(v.seconds) === null ? null : Math.round(v.seconds!),
    note: v.note?.trim().slice(0, 120) || null, done: true, logged_at: new Date().toISOString(),
  });
  return error ? { error: error.message } : { ok: true };
}

/**
 * Finish: mark it done, +5 CPs, and check off her Strength habits for the week
 * ("Do 1 full-body workout" after the first, "Do 2" after the second, "Train 3x" after the third)
 * and the sprints habit after Hill Sprints.
 */
export async function finishWorkout(sessionId: string) {
  const { supabase, user } = await me();
  if (!user) return { error: "Not signed in" };
  const { data: s } = await supabase.from("workout_sessions").select("id, workout_id, program_week, completed_at, workouts(name, kind)")
    .eq("id", sessionId).eq("client_id", user.id).single();
  if (!s) return { error: "Workout not found" };
  const { data: p } = await supabase.from("profiles").select("timezone").eq("id", user.id).single();
  const today = todayIn(p?.timezone ?? "America/Los_Angeles");
  const w = s.workouts as unknown as { name: string; kind: string } | null;
  let cps = 0;
  if (!s.completed_at) {
    await supabase.from("workout_sessions").update({ completed_at: new Date().toISOString() }).eq("id", sessionId);
    await supabase.from("cp_ledger").insert({ client_id: user.id, points: WORKOUT_CPS, reason: "workout", source_id: sessionId });
    cps += WORKOUT_CPS;

    const habits: string[] = [];
    if (w?.kind === "strength") {
      const { count } = await supabase.from("workout_sessions").select("id, workouts!inner(kind)", { count: "exact", head: true })
        .eq("client_id", user.id).eq("program_week", s.program_week).not("completed_at", "is", null).eq("workouts.kind", "strength");
      const n = count ?? 1;
      const { data: items } = await supabase.from("ring_items").select("id, title, rings!inner(circles!inner(slug))")
        .eq("cadence", "weekly").eq("rings.circles.slug", "strength");
      for (const i of items ?? []) {
        const t = String(i.title);
        if ((/Do 1 full-body/i.test(t) && n >= 1) || (/Do 2 full-body/i.test(t) && n >= 2) || (/Train 3x/i.test(t) && n >= 3)) habits.push(i.id as string);
      }
    }
    if (/hill sprints/i.test(w?.name ?? "")) {
      const { data: items } = await supabase.from("ring_items").select("id").eq("habit_key", "sprints");
      habits.push(...(items ?? []).map((i) => i.id as string));
    }
    if (habits.length) {
      const { data: had } = await supabase.from("habit_logs").select("item_id").eq("client_id", user.id).eq("log_date", today).in("item_id", habits);
      const fresh = habits.filter((h) => !(had ?? []).some((x) => x.item_id === h));
      if (fresh.length) {
        await supabase.from("habit_logs").upsert(fresh.map((id) => ({ client_id: user.id, item_id: id, log_date: today, done: true })));
        await supabase.from("cp_ledger").insert(fresh.map((id) => ({ client_id: user.id, points: 1, reason: `habit:${today}`, source_id: id })));
        cps += fresh.length;
      }
      await closeOutRings(supabase, user.id);
    }
  }
  revalidatePath("/", "layout");
  return { ok: true, cps };
}
