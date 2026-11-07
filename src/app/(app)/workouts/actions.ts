"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayIn, trainingWeek } from "@/lib/program";
import { closeOutRings } from "@/lib/progress";
import { earlyWeek } from "@/lib/workouts";

const WORKOUT_CPS = 5;

async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Opens (or reopens) this week's session for a workout, so every set she logs is saved as she goes. */
export async function startSession(workoutId: number, ahead?: number) {
  const { supabase, user } = await me();
  if (!user) return { error: "Not signed in" };
  const { data: p } = await supabase.from("profiles").select("program_start, timezone").eq("id", user.id).single();
  let week = trainingWeek(p?.program_start ?? null, todayIn(p?.timezone ?? "America/Los_Angeles"));
  // Next week's workout, started early (November 7): only once this week's are all done.
  if (ahead !== undefined && ahead !== week) {
    if (ahead !== (await earlyWeek(supabase, user.id))) return { error: "Finish this week's workouts first, then you can start next week's." };
    week = ahead;
  }
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

type ExRow = { id: number; name: string; clip_path: string | null; youtube_id: string | null; notes: string | null };
const cleanEx = (n: string) => n.replace(/\s*\((SLTP|PSR|SLF|DWTP)\)\s*$/i, "").trim();

/** The swap list: videos first, shortest names first, each exercise once, with her last numbers on it. */
async function shape(supabase: Awaited<ReturnType<typeof me>>["supabase"], userId: string, data: ExRow[], skip: string[] = [], max = 12) {
  const { clipUrl, posterUrl, lastNumbers } = await import("@/lib/workouts");
  const seen = new Set(skip.map((n) => cleanEx(n).toLowerCase()));
  const rows = data
    .sort((a, b) => Number(!!b.clip_path || !!b.youtube_id) - Number(!!a.clip_path || !!a.youtube_id) || cleanEx(a.name).length - cleanEx(b.name).length)
    .filter((e) => { const k = cleanEx(e.name).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, max);
  const last = await lastNumbers(supabase, userId, rows.map((e) => e.id));
  return rows.map((e) => ({
    id: e.id, name: cleanEx(e.name), notes: e.notes ?? null, clip: clipUrl(e), poster: posterUrl(e), youtube: e.youtube_id ?? null,
    last: last.get(e.id)?.sets ?? [], lastWhen: last.get(e.id)?.when ?? null,
  }));
}

/**
 * Substitute (November 2): find any exercise by name, with its video and what she lifted last time on it.
 * Overview videos ("PSR Phase 1 Day 1") are left out; names show without the program tag.
 */
export async function searchExercises(query: string) {
  const { supabase, user } = await me();
  const q = query.trim().replace(/[%_,()]/g, " ").replace(/\s+/g, " ");
  if (!user || q.length < 2) return [];
  let req = supabase.from("exercises").select("id, name, clip_path, youtube_id, notes").not("name", "ilike", "%phase % day %").limit(60);
  for (const word of q.split(" ").slice(0, 4)) req = req.ilike("name", `%${word}%`);
  const { data } = await req;
  return shape(supabase, user.id, (data ?? []) as ExRow[]);
}

/**
 * Suggested swaps (November 3): exercises that train the same movement, shown as soon as she taps Substitute,
 * before she types anything. Single exercises only (no supersets), with a video.
 */
const FAMILIES: [RegExp, string[]][] = [
  [/leg curl|hamstring curl|nordic|ghd/i, ["leg curl", "hamstring curl", "nordic", "stability ball curl", "romanian"]],
  [/lunge|split squat|step ?up|bulgarian/i, ["lunge", "split squat", "step up", "bulgarian"]],
  [/squat|leg press|hack/i, ["squat", "leg press", "goblet", "split squat"]],
  [/deadlift|rdl|romanian|good morning|hip thrust|glute bridge|swing|pull ?through|hinge/i, ["deadlift", "romanian", "hip thrust", "glute bridge", "good morning", "swing"]],
  [/bench|push ?up|pushup|chest press|squeeze press|fly|flye/i, ["bench press", "push up", "pushup", "chest press", "dumbbell press", "fly"]],
  [/shoulder press|overhead press|military|arnold|landmine press|push press/i, ["shoulder press", "overhead press", "arnold", "landmine press"]],
  [/pull ?up|chin ?up|pulldown|pull down|lat /i, ["pulldown", "pull down", "pull up", "pullup", "chin up"]],
  [/row/i, ["row"]],
  [/tricep|skull|pushdown|kickback|dip/i, ["tricep", "skull", "pushdown", "kickback", "dip"]],
  [/curl/i, ["bicep curl", "hammer curl", "curl"]],
  [/lateral raise|rear delt|face ?pull|front raise|raise/i, ["lateral raise", "rear delt", "face pull", "front raise"]],
  [/calf/i, ["calf"]],
  [/plank|crunch|leg raise|dead ?bug|toes to bar|pallof|sit ?up|v ?up|hollow|ab /i, ["plank", "dead bug", "crunch", "leg raise", "pallof", "hollow"]],
  [/jump|sprint|burpee|rope|bike|skater|climber/i, ["jump", "burpee", "sprint", "mountain climber", "skater"]],
];
export async function suggestExercises(name: string) {
  const { supabase, user } = await me();
  if (!user) return [];
  const main = cleanEx(name).split(/\s+-\s+/)[0];
  const terms = FAMILIES.find(([re]) => re.test(main))?.[1];
  if (!terms) return [];
  const { data } = await supabase.from("exercises").select("id, name, clip_path, youtube_id, notes")
    .or(terms.map((t) => `name.ilike.%${t.replace(/[,()]/g, "")}%`).join(","))
    .not("name", "ilike", "%phase % day %").not("name", "ilike", "% - %").limit(150);
  const withVideo = ((data ?? []) as ExRow[]).filter((e) => e.clip_path || e.youtube_id);
  return shape(supabase, user.id, withVideo, [name], 8);
}
