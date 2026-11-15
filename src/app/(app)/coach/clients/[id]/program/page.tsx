import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProgramBuilder, { type Day } from "./ProgramBuilder";

/** November 15: Michael's custom workout program for one client (Claudia, at her own gym). */
export default async function CustomProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  if (me?.role !== "coach") redirect("/today");
  const { data: p } = await supabase.from("profiles").select("full_name, workout_program, strength_days_per_week").eq("id", id).single();
  const first = ((p?.full_name as string | null) ?? "her").split(" ")[0];
  const current = (p?.workout_program as string | null) ?? "sltp";
  const { data: mine } = await supabase.from("programs").select("id, name").like("id", `custom-${id.slice(0, 8)}-%`).order("id", { ascending: false });
  const prog = (mine ?? []).find((x) => x.id === current) ?? (mine ?? [])[0] ?? null;

  let phaseId: number | null = null;
  let days: Day[] = [];
  let cardio: string[] = [];
  if (prog) {
    const { data: ph } = await supabase.from("program_phases").select("id").eq("program", prog.id).order("position").limit(1).maybeSingle();
    phaseId = (ph?.id as number | undefined) ?? null;
    if (phaseId) {
      const { data: links } = await supabase.from("phase_workouts")
        .select("day, workouts(id, name, kind, workout_items(position, sets, target, rest_seconds, log_type, exercises(id, name, clip_path, youtube_id)))").eq("phase_id", phaseId);
      type W = { id: number; name: string; kind: string; workout_items: { position: number; sets: number; target: string | null; rest_seconds: number | null; log_type: string; exercises: { id: number; name: string; clip_path: string | null; youtube_id: string | null } | null }[] };
      const rows = (links ?? []) as unknown as { day: number | null; workouts: W | null }[];
      days = rows.filter((r) => r.workouts?.kind === "strength" && r.day).sort((a, b) => a.day! - b.day!).map((r) => ({
        day: r.day!, workoutId: r.workouts!.id, name: r.workouts!.name,
        items: [...r.workouts!.workout_items].sort((a, b) => a.position - b.position).filter((i) => i.exercises).map((i) => ({
          exercise_id: i.exercises!.id, name: i.exercises!.name, video: !!(i.exercises!.clip_path || i.exercises!.youtube_id),
          sets: i.sets, target: i.target ?? "", rest_seconds: i.rest_seconds, log_type: i.log_type,
        })),
      }));
      cardio = rows.filter((r) => r.workouts?.kind === "cardio").map((r) => r.workouts!.name);
    }
  }
  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <Link href={`/coach/clients/${id}`} className="inline-flex min-h-11 items-center text-sm text-dim">← {p?.full_name ?? "Client"}</Link>
      <header>
        <p className="text-xs uppercase tracking-[0.15em] text-accent">{p?.full_name}</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl uppercase">Custom workout program</h1>
        <p className="mt-1 text-[14px] text-dim">Workouts made just for {first}: her days, her exercises, her sets and reps. She sees them in her Workouts tab as usual and logs them the same way.</p>
      </header>
      <ProgramBuilder clientId={id} first={first} program={prog ? { id: prog.id as string, name: prog.name as string, inUse: prog.id === current } : null}
        phaseId={phaseId} days={days} cardio={cardio} currentDays={(p?.strength_days_per_week as number | null) ?? 3} />
    </section>
  );
}
