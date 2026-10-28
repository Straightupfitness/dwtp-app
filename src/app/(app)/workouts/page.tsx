import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { IconDumbbell } from "@/components/Icons";
import { cardioType, KIND_LABEL, KIND_NOTE, loadWorkoutWeek, phaseLabel, stageOf, type WorkoutCard } from "@/lib/workouts";
import BackButton from "@/components/BackButton";
import PhaseCard from "./PhaseCard";

const display = "font-[family-name:var(--font-display)] uppercase";
const fmtDate = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

function Check() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
}

/** A strength day: big picture, what it is, and where she is with it. */
function DayCard({ w, next, week, preview }: { w: WorkoutCard; next: boolean; week: number; preview: boolean }) {
  const status = w.done ? "Done" : w.started ? "Continue" : next ? "Start" : "Open";
  return (
    <Link href={`/workouts/${w.id}${preview ? `?w=${week}` : ""}`}
      className={`group flex items-stretch gap-3 overflow-hidden rounded-[18px] border bg-card p-2.5 ${next && !preview ? "border-accent" : "border-border"}`}>
      <span className="relative block size-[92px] shrink-0 overflow-hidden rounded-[14px] bg-[#1b1b1b]">
        {/* eslint-disable-next-line @next/next/no-img-element -- storage poster */}
        {w.poster && <img src={w.poster} alt="" className={`size-full object-cover ${w.done ? "opacity-40" : ""}`} />}
        {w.done && <span className="absolute inset-0 grid place-items-center"><span className="grid size-9 place-items-center rounded-full bg-[var(--green,#22c55e)] text-black"><Check /></span></span>}
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        {next && !preview && !w.done && <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Up next</span>}
        <span className={`${display} text-[22px] leading-none`}>{w.title}</span>
      </span>
      <span className="flex items-center pr-1">
        <span className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${w.done ? "text-dim" : next && !preview ? "bg-accent text-black" : "border border-[#2f2f2f] text-text"}`}>{status}</span>
      </span>
    </Link>
  );
}

export default async function WorkoutsPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const sp = await searchParams;
  const asked = Number(sp.w) || undefined;
  const first = await loadWorkoutWeek(supabase, user!.id);
  // Before her start date she sees Week 1 as a preview.
  const preview = !asked && first.week < 1;
  const data = asked || preview ? await loadWorkoutWeek(supabase, user!.id, asked ?? 1) : first;
  const { phase } = data;
  const stage = stageOf(phase?.stage ?? "DWTP", data.program.name);
  const done = data.strength.filter((s) => s.done).length;

  // Strength workouts she finished in each week of this phase (her program weeks map onto the phase's weeks).
  const perWeek = data.strength.length;
  const doneByWeek: number[] = phase ? Array(phase.weeks).fill(0) : [];
  if (phase && !preview && data.weekOfPhase > 1) {
    const firstHer = data.week - (data.weekOfPhase - 1);
    const { data: past } = await supabase.from("workout_sessions").select("program_week, workouts!inner(kind)")
      .eq("client_id", user!.id).gte("program_week", firstHer).lt("program_week", data.week).not("completed_at", "is", null).eq("workouts.kind", "strength");
    for (const r of past ?? []) { const i = (r.program_week as number) - firstHer; if (i >= 0 && i < doneByWeek.length) doneByWeek[i] = Math.min(perWeek, doneByWeek[i] + 1); }
  }
  if (phase) doneByWeek[data.weekOfPhase - 1] = done;
  const nextIdx = data.nextUp ? data.strength.findIndex((s) => s.id === data.nextUp!.id) : -1;
  const nextUp = !preview && !asked ? data.nextUp : null;

  return (
    <section className="space-y-4">
      <BackButton fallback="/today" />
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Proper Strength Training</p>
        <h1 className={`${display} mt-1 text-[30px] font-semibold`}>Workouts</h1>
      </header>

      {!phase ? (
        <div className="rounded-[18px] border border-border bg-card p-4 text-[15px]">
          {data.pweek > data.totalWeeks ? "You've finished all of the program's weeks. Michael will set up what's next with you." : "Your workouts show up here once your program starts."}
        </div>
      ) : (
        <>
          <PhaseCard stage={stage} kindLabel={KIND_LABEL[phase.kind]} kindNote={KIND_NOTE[phase.kind]} name={phaseLabel(phase.name, phase.stage)}
            weeks={phase.weeks} weekOfPhase={data.weekOfPhase} perWeek={perWeek} doneByWeek={doneByWeek} next={nextIdx >= 0 ? nextIdx : null}
            intro={preview && data.start ? <p className="mb-2 text-[13px] text-[#d9c9a8]">Your program starts {fmtDate(data.start)}. Here&apos;s a look at Week 1.</p> : null} />

          {/* Her next workout (moved here from Today, October 28). */}
          {nextUp && (
            <Link href={`/workouts/${nextUp.id}`} className="flex items-center gap-3 rounded-2xl border border-accent bg-card p-2.5">
              <span className="relative block size-[68px] shrink-0 overflow-hidden rounded-xl bg-[#1b1b1b]">
                {/* eslint-disable-next-line @next/next/no-img-element -- storage poster */}
                {nextUp.poster && <img src={nextUp.poster} alt="" className="size-full object-cover" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`${display} flex items-center gap-1.5 text-lg font-medium`}><span className="text-accent"><IconDumbbell /></span>Your next workout</span>
                <span className="block text-[13px] text-[#a8a8a8]">{nextUp.title} · {done} of {perWeek} done this week</span>
              </span>
              <span className="shrink-0 rounded-full bg-accent px-3.5 py-2 text-[13px] font-semibold text-black">{nextUp.started ? "Continue" : "Start"}</span>
            </Link>
          )}

          <div className="flex items-baseline justify-between">
            <h2 className={`${display} text-lg`}>This week</h2>
            <p className="text-[13px] text-dim">{done} of {data.strength.length} done</p>
          </div>
          <div className="space-y-2.5">
            {data.strength.map((w) => <DayCard key={w.id} w={w} next={data.nextUp?.id === w.id} week={data.week} preview={preview || !!asked} />)}
          </div>
          {data.strength.length > 0 && done === data.strength.length && (
            <p className="rounded-[14px] border border-[#1f3a24] bg-[#0f1a11] p-3 text-[14px] text-[#b7e4c0]">Every workout this week is done. That&apos;s how it&apos;s done.</p>
          )}

          <div className="pt-2">
            <h2 className={`${display} text-lg`}>Cardio menu</h2>
            <p className="mt-1 text-[13px] leading-snug text-dim">Pick one or two hard sessions a week, on their own day. Keep walking every day.</p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {data.cardio.map((w) => (
              <Link key={w.id} href={`/workouts/${w.id}`} className="overflow-hidden rounded-[16px] border border-border bg-card">
                <span className="relative block aspect-[16/10] bg-[#1b1b1b]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- poster */}
                  {w.poster && <img src={w.poster} alt="" className="size-full object-cover opacity-80" />}
                  <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-[#fb7185]">{cardioType(w.name)}</span>
                  {w.done && <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-[#22c55e] text-black"><Check /></span>}
                </span>
                <span className="block px-2.5 py-2">
                  <span className="block truncate text-[14px] font-semibold">{w.title}</span>
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
