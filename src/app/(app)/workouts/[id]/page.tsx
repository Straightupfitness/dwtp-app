import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clipUrl, lastNumbers, loadWorkoutWeek, posterUrl, STAGES, workoutTitle, type Item } from "@/lib/workouts";
import Player, { type PlayerItem } from "./Player";

export default async function WorkoutPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ w?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: w } = await supabase.from("workouts")
    .select("id, name, kind, circuit, rounds, minutes, notes, workout_items(position, sets, target, seconds, rest_seconds, log_type, exercise:exercises(id, name, notes, youtube_id, clip_path))")
    .eq("id", Number(id)).maybeSingle();
  if (!w) notFound();
  const items = ((w.workout_items ?? []) as unknown as Item[]).filter((i) => i.exercise).sort((a, b) => a.position - b.position);

  const wk = await loadWorkoutWeek(supabase, user!.id, Number(sp.w) || undefined);
  const preview = wk.week < 1 || !!sp.w && Number(sp.w) !== wk.current;
  const { data: session } = wk.week >= 1 && !preview
    ? await supabase.from("workout_sessions").select("id, completed_at").eq("client_id", user!.id).eq("workout_id", w.id).eq("program_week", wk.week).maybeSingle()
    : { data: null };
  const { data: logs } = session
    ? await supabase.from("set_logs").select("position, set_no, weight, reps, seconds, note").eq("session_id", session.id)
    : { data: [] };
  const last = await lastNumbers(supabase, user!.id, [...new Set(items.map((i) => i.exercise.id))], session?.id);

  // The first video named like the workout is Michael's overview: it goes on the start screen.
  const overview = items.find((i) => i.position <= 2 && i.exercise.youtube_id && i.exercise.name.trim().toLowerCase() === w.name.trim().toLowerCase()) ?? null;
  const steps: PlayerItem[] = items.filter((i) => i !== overview).map((i) => ({
    position: i.position, sets: i.sets, target: i.target, seconds: i.seconds, rest: i.rest_seconds, logType: i.log_type,
    exerciseId: i.exercise.id, name: i.exercise.name.replace(/\s*\((SLTP|PSR|SLF|DWTP)\)\s*$/i, ""), notes: i.exercise.notes,
    youtube: i.exercise.youtube_id, clip: clipUrl(i.exercise), poster: posterUrl(i.exercise),
    last: last.get(i.exercise.id)?.sets ?? [], lastWhen: last.get(i.exercise.id)?.when ?? null,
    logged: (logs ?? []).filter((l) => l.position === i.position).map((l) => ({ set_no: l.set_no, weight: l.weight, reps: l.reps, seconds: l.seconds, note: l.note })),
  }));
  const phase = wk.phase && wk.strength.some((s) => s.id === w.id) ? wk.phase : null;
  const stage = phase ? STAGES[phase.stage] : null;

  return (
    <Player
      workout={{ id: w.id, name: w.name, title: workoutTitle(w.name), kind: w.kind as "strength" | "cardio", circuit: w.circuit, rounds: w.rounds, minutes: w.minutes, notes: w.notes }}
      phase={phase ? { name: phase.name, week: wk.weekOfPhase, weeks: phase.weeks, color: stage?.color ?? "#f5a623", label: stage?.label ?? phase.stage } : null}
      overview={overview ? { youtube: overview.exercise.youtube_id!, notes: overview.exercise.notes } : null}
      steps={steps}
      session={session ? { id: session.id as string, completed: !!session.completed_at } : null}
      preview={preview}
    />
  );
}
