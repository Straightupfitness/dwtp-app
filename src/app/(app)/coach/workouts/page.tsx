import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SmoothDrawers from "@/components/SmoothDrawers";
import LibraryView, { type LibProgram, type LibWorkout } from "./LibraryView";

export const dynamic = "force-dynamic";

/** Every page of a big table (Supabase returns 1,000 rows at most per request). */
async function all<T>(get: (a: number, b: number) => PromiseLike<{ data: unknown[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let a = 0; ; a += 1000) {
    const { data } = await get(a, a + 999);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

/**
 * November 19 (Michael): his Workouts tab shows the whole library: every program imported from Trainerize (and the
 * custom ones), phase by phase, plus the workouts that aren't in any program. Tap one to look through it.
 */
export default async function CoachWorkouts() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  if (me?.role !== "coach") redirect("/workouts");
  const [programs, phases, links, workouts, items, profiles] = await Promise.all([
    all<{ id: string; name: string; description: string | null; sort: number | null; weeks: number | null }>((a, b) => supabase.from("programs").select("id, name, description, sort, weeks").order("sort").range(a, b)),
    all<{ id: number; program: string; name: string; stage: string | null; weeks: number; first_week: number; position: number }>((a, b) => supabase.from("program_phases").select("id, program, name, stage, weeks, first_week, position").order("position").range(a, b)),
    all<{ phase_id: number; workout_id: number; day: number | null; from_week: number | null; to_week: number | null }>((a, b) => supabase.from("phase_workouts").select("phase_id, workout_id, day, from_week, to_week").range(a, b)),
    all<{ id: number; name: string; kind: string; minutes: number | null }>((a, b) => supabase.from("workouts").select("id, name, kind, minutes").order("name").range(a, b)),
    all<{ workout_id: number }>((a, b) => supabase.from("workout_items").select("workout_id").range(a, b)),
    all<{ workout_program: string | null; full_name: string | null; status: string | null; role: string | null }>((a, b) => supabase.from("profiles").select("workout_program, full_name, status, role").range(a, b)),
  ]);
  const count = new Map<number, number>();
  for (const i of items) count.set(i.workout_id, (count.get(i.workout_id) ?? 0) + 1);
  const W = new Map(workouts.map((w) => [w.id, w]));
  const lib = (id: number): LibWorkout | null => { const w = W.get(id); return w ? { id: w.id, name: w.name, kind: w.kind, minutes: w.minutes, exercises: count.get(w.id) ?? 0 } : null; };
  const used = new Set(links.map((l) => l.workout_id));
  const who = new Map<string, string[]>();
  for (const p of profiles) if (p.role === "client" && p.status !== "cancelled" && p.workout_program) (who.get(p.workout_program) ?? who.set(p.workout_program, []).get(p.workout_program)!).push((p.full_name ?? "").split(" ")[0]);
  const out: LibProgram[] = programs.map((p) => ({
    id: p.id, name: p.name, description: p.description, weeks: p.weeks, custom: p.id.startsWith("custom-"), clients: who.get(p.id) ?? [],
    phases: phases.filter((ph) => ph.program === p.id).map((ph) => ({
      id: ph.id, name: ph.name, weeks: ph.weeks, firstWeek: ph.first_week,
      workouts: links.filter((l) => l.phase_id === ph.id).sort((a, b) => (a.day ?? 99) - (b.day ?? 99) || (a.from_week ?? 0) - (b.from_week ?? 0))
        .map((l) => { const w = lib(l.workout_id); return w ? { ...w, day: l.day, weeksNote: l.from_week || l.to_week ? `weeks ${l.from_week ?? 1}–${l.to_week ?? ph.weeks} of the phase` : null } : null; })
        .filter((x): x is NonNullable<typeof x> => !!x),
    })),
  }));
  const loose = workouts.filter((w) => !used.has(w.id)).map((w) => lib(w.id)!).filter(Boolean);
  return (
    <section className="mx-auto max-w-5xl space-y-3.5 pb-28">
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Your library</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[30px] font-semibold uppercase">Workouts</h1>
        <p className="mt-1 text-sm text-dim">{programs.length} programs · {workouts.length} workouts. Tap a workout to look through it.</p>
      </header>
      <LibraryView programs={out} loose={loose} />
      <SmoothDrawers />
    </section>
  );
}
