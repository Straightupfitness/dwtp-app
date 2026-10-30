import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import { GEAR, GEAR_LABEL } from "@/lib/equipment";
import { workoutLibrary, type LibWorkout } from "@/lib/workout-library";
import { workoutTitle } from "@/lib/workouts";

const display = "font-[family-name:var(--font-display)] uppercase";
type W = LibWorkout;

function Row({ w }: { w: W }) {
  return (
    <Link href={`/workouts/${w.id}`} className="flex items-center gap-3 px-3.5 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{w.kind === "cardio" ? workoutTitle(w.name) : w.name}</span>
        <span className="block truncate text-[12px] text-dim">{w.exercises} exercises{w.minutes ? ` · ${w.minutes} min` : ""} · {w.gear.length ? w.gear.map((g) => GEAR_LABEL[g]).join(", ") : "Bodyweight only"}</span>
        <span className="block truncate text-[11px] text-dim">{w.programs.slice(0, 2).join(" · ")}</span>
      </span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="2" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
    </Link>
  );
}

function List({ title, items }: { title: string; items: W[] }) {
  if (!items.length) return null;
  return (
    <div className="space-y-1.5">
      <h2 className="text-[11px] uppercase tracking-[0.15em] text-accent">{title} · {items.length}</h2>
      <div className="max-h-[520px] divide-y divide-border overflow-y-auto rounded-2xl border border-border bg-card">{items.map((w) => <Row key={w.id} w={w} />)}</div>
    </div>
  );
}

/**
 * Freestyle (October 30): she ticks the gear she has today (or none), and gets every workout she can do with it:
 * her own program's first, then the rest of Michael's library.
 */
export default async function Freestyle({ searchParams }: { searchParams: Promise<{ gear?: string | string[]; go?: string }> }) {
  const sp = await searchParams;
  const have = new Set((Array.isArray(sp.gear) ? sp.gear : sp.gear ? sp.gear.split(",") : []).filter((g) => GEAR_LABEL[g]));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: p } = await supabase.from("profiles").select("workout_program").eq("id", user!.id).single();
  const { data: prog } = await supabase.from("programs").select("name").eq("id", p?.workout_program ?? "sltp").maybeSingle();
  const lib = sp.go ? await workoutLibrary(supabase) : [];
  const fits = lib.filter((w) => w.gear.every((g) => have.has(g)));
  const seen = new Set<string>();
  const unique = fits.filter((w) => { const k = w.name.trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  const mine = unique.filter((w) => prog?.name && w.programs.includes(prog.name));
  const strength = unique.filter((w) => !mine.includes(w) && w.kind === "strength");
  const cardio = unique.filter((w) => !mine.includes(w) && w.kind === "cardio");

  return (
    <section className="space-y-4">
      <BackButton fallback="/workouts" />
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Train with what you&apos;ve got</p>
        <h1 className={`${display} mt-1 text-[30px] font-semibold`}>Freestyle workout</h1>
        <p className="mt-1 text-[14px] text-[#a8a8a8]">Traveling, home gym, or a busy gym? Tick what you have and pick a workout that fits.</p>
      </header>
      <form action="/workouts/freestyle" className="space-y-3 rounded-2xl border border-border bg-card p-3.5">
        <input type="hidden" name="go" value="1" />
        <p className="text-[14px] font-semibold">What do you have access to?</p>
        <div className="grid grid-cols-2 gap-2">
          {GEAR.map((g) => (
            <label key={g.key} className="flex min-h-11 items-center gap-2.5 rounded-xl border border-[#2a2a2a] px-3 text-[14px] has-[:checked]:border-accent has-[:checked]:bg-accent/10">
              <input type="checkbox" name="gear" value={g.key} defaultChecked={have.has(g.key)} className="size-5 accent-[var(--accent)]" />{g.label}
            </label>
          ))}
        </div>
        <p className="text-[12px] text-dim">Nothing ticked = bodyweight only.</p>
        <button className="min-h-12 w-full rounded-xl bg-accent font-semibold text-black">Find my workouts</button>
      </form>
      {sp.go && (unique.length
        ? <>
            <List title="From your program" items={mine} />
            <List title="Strength workouts" items={strength} />
            <List title="Cardio" items={cardio} />
          </>
        : <p className="rounded-2xl border border-dashed border-[#2f2f2f] p-6 text-center text-dim">Nothing fits that exactly. Tick one more piece of gear, or ask Michael for a workout.</p>)}
    </section>
  );
}
