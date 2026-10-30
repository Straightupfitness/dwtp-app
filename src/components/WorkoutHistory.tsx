import type { SupabaseClient } from "@supabase/supabase-js";

type Ex = { name: string; sets: { reps: number | null; weight: number | null; seconds: number | null; distance: number | null }[] };
type Entry = { key: string; date: string; name: string; minutes: number | null; calories: number | null; from: string; exercises: Ex[] };

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const setText = (s: Ex["sets"][number]) => [
  s.reps !== null ? `${s.reps}${s.weight ? ` × ${+s.weight} lb` : " reps"}` : s.weight ? `${+s.weight} lb` : null,
  s.seconds ? mmss(s.seconds) : null, s.distance ? `${+s.distance} mi` : null,
].filter(Boolean).join(" · ");

/**
 * Every workout she's done (October 29): the ones from Trainerize, with each set's reps and weight, and the ones
 * she's finished in this app. Newest first, by month.
 */
export default async function WorkoutHistory({ supabase, clientId }: { supabase: SupabaseClient; clientId: string }) {
  const [{ data: hist }, { data: sessions }] = await Promise.all([
    supabase.from("workout_history").select("id, performed_on, name, minutes, calories, exercises").eq("client_id", clientId).order("performed_on", { ascending: false }).limit(1000),
    supabase.from("workout_sessions").select("id, started_at, completed_at, workouts(name), set_logs(position, set_no, reps, weight, seconds, exercise_id, exercises(name))")
      .eq("client_id", clientId).not("completed_at", "is", null).order("completed_at", { ascending: false }).limit(300),
  ]);
  const entries: Entry[] = [];
  for (const h of hist ?? []) entries.push({
    key: `h${h.id}`, date: h.performed_on, name: h.name, minutes: h.minutes, calories: h.calories, from: "Trainerize",
    exercises: ((h.exercises ?? []) as { name: string; sets: (number | null)[][] }[]).map((x) => ({
      name: x.name, sets: (x.sets ?? []).map((s) => ({ reps: s[1], weight: s[2], seconds: s[3], distance: s[4] })).filter((s) => s.reps !== null || s.weight || s.seconds || s.distance),
    })),
  });
  type S = { id: string; started_at: string; completed_at: string; workouts: { name: string } | null; set_logs: { position: number; set_no: number; reps: number | null; weight: number | null; seconds: number | null; exercises: { name: string } | null }[] };
  for (const s of (sessions ?? []) as unknown as S[]) {
    const byPos = new Map<number, Ex>();
    for (const l of [...s.set_logs].sort((a, b) => a.position - b.position || a.set_no - b.set_no)) {
      if (!byPos.has(l.position)) byPos.set(l.position, { name: l.exercises?.name ?? "Exercise", sets: [] });
      byPos.get(l.position)!.sets.push({ reps: l.reps, weight: l.weight, seconds: l.seconds, distance: null });
    }
    const m = (Date.parse(s.completed_at) - Date.parse(s.started_at)) / 60000;
    entries.push({ key: s.id, date: s.completed_at.slice(0, 10), name: s.workouts?.name ?? "Workout", minutes: m > 0 && m < 600 ? Math.round(m) : null, calories: null, from: "DWTP", exercises: [...byPos.values()] });
  }
  entries.sort((a, b) => b.date.localeCompare(a.date));
  if (!entries.length) return <p className="rounded-2xl border border-dashed border-[#2f2f2f] p-6 text-center text-dim">No workouts yet. Finished workouts show up here.</p>;

  const months = new Map<string, Entry[]>();
  for (const e of entries) { const k = e.date.slice(0, 7); months.set(k, [...(months.get(k) ?? []), e]); }
  const day = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-dim">{entries.length.toLocaleString()} workouts</p>
      {[...months].map(([k, list]) => (
        <div key={k} className="space-y-1.5">
          <h2 className="text-[11px] uppercase tracking-[0.15em] text-accent">{new Date(k + "-15T12:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })} · {list.length}</h2>
          <div className="divide-y divide-border rounded-2xl border border-border bg-card">
            {list.map((e) => (
              <details key={e.key} className="group px-3.5">
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{e.name}</span>
                    <span className="block text-[12px] text-dim">{day(e.date)}{e.minutes ? ` · ${e.minutes} min` : ""}{e.exercises.length ? ` · ${e.exercises.length} exercises` : ""}{e.from === "Trainerize" ? " · from Trainerize" : ""}</span>
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="2" aria-hidden="true" className="shrink-0 transition group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
                </summary>
                <ul className="mb-3 space-y-2 border-t border-border pt-2.5">
                  {e.exercises.map((x, i) => (
                    <li key={i} className="text-[14px]">
                      <span className="block font-medium">{x.name}</span>
                      {x.sets.length > 0 && <span className="block text-[13px] text-[#a8a8a8]">{x.sets.map(setText).filter(Boolean).join("  ·  ")}</span>}
                    </li>
                  ))}
                  {!e.exercises.length && <li className="text-[13px] text-dim">No sets recorded.</li>}
                </ul>
              </details>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
