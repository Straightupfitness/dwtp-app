"use client";
import Link from "next/link";
import { useMemo, useState } from "react";

export type LibWorkout = { id: number; name: string; kind: string; minutes: number | null; exercises: number };
export type LibProgram = {
  id: string; name: string; description: string | null; weeks: number | null; custom: boolean; clients: string[];
  phases: { id: number; name: string; weeks: number; firstWeek: number; workouts: (LibWorkout & { day: number | null; weeksNote: string | null })[] }[];
};

const Row = ({ w, day, note }: { w: LibWorkout; day?: number | null; note?: string | null }) => (
  <li>
    <Link href={`/workouts/${w.id}`} className="flex min-h-11 items-center gap-3 px-3 py-2 hover:bg-[#161616]">
      {day ? <span className="w-12 shrink-0 text-[11px] uppercase tracking-wide text-accent">Day {day}</span> : <span className="w-12 shrink-0 text-[11px] uppercase tracking-wide text-dim">{w.kind === "cardio" ? "Cardio" : "—"}</span>}
      <span className="min-w-0 flex-1"><span className="block truncate text-[14px]">{w.name}</span>{note && <span className="block text-[11px] text-dim">{note}</span>}</span>
      <span className="shrink-0 text-[12px] text-dim">{w.exercises} exercises{w.minutes ? ` · ${w.minutes} min` : ""}</span>
    </Link>
  </li>
);

/** November 19: the whole workout library, searchable, program by program. */
export default function LibraryView({ programs, loose }: { programs: LibProgram[]; loose: LibWorkout[] }) {
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"programs" | "custom" | "other">("programs");
  const needle = q.trim().toLowerCase();
  const hit = (w: LibWorkout) => w.name.toLowerCase().includes(needle);
  const list = useMemo(() => programs.filter((p) => (show === "custom" ? p.custom : !p.custom)), [programs, show]);
  const found = needle ? [...programs.flatMap((p) => p.phases.flatMap((ph) => ph.workouts.filter(hit).map((w) => ({ w, where: `${p.name} · ${ph.name}` })))), ...loose.filter(hit).map((w) => ({ w, where: "Not in a program" }))] : [];
  const tab = (v: typeof show, label: string, n: number) => (
    <button type="button" onClick={() => setShow(v)} aria-pressed={show === v}
      className={`min-h-10 rounded-full px-4 text-sm ${show === v ? "bg-accent font-semibold text-black" : "border border-border text-dim"}`}>{label} <span className="opacity-70">{n}</span></button>
  );
  return (
    <div className="space-y-3">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search every workout by name…" aria-label="Search workouts"
        className="min-h-12 w-full rounded-2xl border border-border bg-card px-4 text-[15px] outline-none focus:border-accent" />
      {needle ? (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {found.slice(0, 80).map(({ w, where }, i) => <Row key={`${w.id}-${i}`} w={w} note={where} />)}
          {!found.length && <li className="p-4 text-sm text-dim">No workout matches “{q.trim()}”.</li>}
        </ul>
      ) : <>
        <div className="flex flex-wrap gap-2">
          {tab("programs", "Programs", programs.filter((p) => !p.custom).length)}
          {tab("custom", "Client programs", programs.filter((p) => p.custom).length)}
          {tab("other", "Not in a program", loose.length)}
        </div>
        {show === "other" ? (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">{loose.map((w) => <Row key={w.id} w={w} />)}</ul>
        ) : list.map((p) => (
          <details key={p.id} data-drawer className="group rounded-2xl border border-border bg-card">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">{p.name}</span>
                <span className="block text-[12px] text-dim">{p.phases.length} phase{p.phases.length === 1 ? "" : "s"}{p.weeks ? ` · ${p.weeks} weeks` : ""}{p.clients.length ? ` · on it: ${p.clients.join(", ")}` : ""}</span>
                {p.description && <span className="mt-0.5 block text-[12px] text-[#bdbdbd]">{p.description}</span>}
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="2" aria-hidden="true" className="shrink-0 transition group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
            </summary>
            <div className="space-y-2.5 px-3 pb-3">
              {p.phases.map((ph) => (
                <div key={ph.id} className="overflow-hidden rounded-xl border border-border">
                  <p className="flex justify-between bg-[#151515] px-3 py-1.5 text-[12px]"><b>{ph.name}</b><span className="text-dim">week {ph.firstWeek}{ph.weeks > 1 ? `–${ph.firstWeek + ph.weeks - 1}` : ""}</span></p>
                  <ul className="divide-y divide-border">{ph.workouts.map((w, i) => <Row key={`${w.id}-${i}`} w={w} day={w.day} note={w.weeksNote} />)}</ul>
                  {!ph.workouts.length && <p className="px-3 py-2 text-[12px] text-dim">No workouts in this phase.</p>}
                </div>
              ))}
            </div>
          </details>
        ))}
      </>}
    </div>
  );
}
