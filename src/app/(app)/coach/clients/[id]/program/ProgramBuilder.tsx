"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDay, addExercise, copyWorkoutInto, createCustomProgram, findWorkouts, listPrograms, removeLastDay, saveDay, searchExercises, assignProgram, type ItemInput } from "./actions";

type Item = ItemInput & { name: string; video: boolean };
export type Day = { day: number; workoutId: number; name: string; items: Item[] };

const LOGS: [string, string][] = [["strength", "Weight × reps"], ["endurance", "Reps only"], ["timedLongerBetter", "Time"], ["timedStrength", "Weight + note"], ["general", "Just tick it off"]];
const input = "min-h-10 rounded-lg border border-[#2a2a2a] bg-bg px-2 text-[14px] outline-none focus:border-accent";

/** November 15: build and edit one client's custom program, one workout day at a time. */
export default function ProgramBuilder({ clientId, first, program, phaseId, days, cardio, currentDays }: {
  clientId: string; first: string; program: { id: string; name: string; inUse: boolean } | null; phaseId: number | null; days: Day[]; cardio: string[]; currentDays: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [n, setN] = useState(Math.min(6, Math.max(1, currentDays)));
  const [copy, setCopy] = useState(true);
  const [err, setErr] = useState("");
  const run = (f: () => Promise<{ error?: string; ok?: boolean }>) => start(async () => { setErr(""); const r = await f(); if (r?.error) setErr(r.error); else router.refresh(); });

  if (!program || !phaseId) return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <p className="text-[15px] font-semibold">Make a custom program for {first}</p>
      <label className="flex items-center gap-2 text-[14px]">Workout days a week
        <select value={n} onChange={(e) => setN(Number(e.target.value))} className={input}>{[1, 2, 3, 4, 5, 6].map((x) => <option key={x}>{x}</option>)}</select>
      </label>
      <label className="flex items-start gap-2 text-[14px]">
        <input type="checkbox" checked={copy} onChange={(e) => setCopy(e.target.checked)} className="mt-1 size-4 accent-[var(--accent)]" />
        <span>Start from her current workouts (then change what you need). Untick to start with empty days.</span>
      </label>
      <p className="text-[12px] text-dim">She switches to it right away; her usual cardio menu comes along. You can switch her back to the main program anytime.</p>
      {err && <p className="text-sm text-[var(--red)]">{err}</p>}
      <button type="button" disabled={pending} onClick={() => run(() => createCustomProgram(clientId, n, copy))} className="min-h-12 w-full rounded-xl bg-accent font-semibold text-black disabled:opacity-50">{pending ? "Making it…" : `Make ${first}'s program`}</button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className={`flex flex-wrap items-center gap-2 rounded-2xl border p-3 ${program.inUse ? "border-[#2f5d3a]" : "border-[#3a2f12]"}`}>
        <p className="min-w-0 flex-1 text-[14px]">{program.inUse ? <>✓ {first} is on this program. Changes show in her Workouts tab right away.</> : <>{first} is <b>not</b> on this program right now.</>}</p>
        {program.inUse
          ? <button type="button" disabled={pending} onClick={() => run(() => assignProgram(clientId, "sltp"))} className="min-h-10 rounded-xl border border-border px-3 text-[13px]">Switch her back to the main program</button>
          : <button type="button" disabled={pending} onClick={() => run(() => assignProgram(clientId, program.id, days.length))} className="min-h-10 rounded-xl bg-accent px-3 text-[13px] font-semibold text-black">Put her on it</button>}
      </div>
      {err && <p className="text-sm text-[var(--red)]">{err}</p>}
      {days.map((d) => <DayEditor key={`${d.workoutId}-${d.items.length}-${d.name}`} clientId={clientId} d={d} />)}
      <div className="flex flex-wrap gap-2">
        {days.length < 6 && <button type="button" disabled={pending} onClick={() => run(() => addDay(clientId, phaseId))} className="min-h-11 rounded-xl border border-accent px-4 text-[14px] font-semibold text-accent">+ Add Day {days.length + 1}</button>}
        {days.length > 1 && <button type="button" disabled={pending} onClick={() => run(() => removeLastDay(clientId, phaseId))} className="min-h-11 rounded-xl border border-border px-4 text-[14px] text-dim">Remove Day {days.length}</button>}
      </div>
      <p className="text-[12px] text-dim">Cardio menu: {cardio.length ? cardio.join(" · ") : "none"}. Her workout days on the calendar still follow the days she picked.</p>
    </div>
  );
}

function DayEditor({ clientId, d }: { clientId: string; d: Day }) {
  const router = useRouter();
  const [name, setName] = useState(d.name);
  const [items, setItems] = useState<Item[]>(d.items);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [picking, setPicking] = useState(false);
  const set = (i: number, patch: Partial<Item>) => { setItems((xs) => xs.map((x, k) => (k === i ? { ...x, ...patch } : x))); setDirty(true); };
  const move = (i: number, by: number) => { setItems((xs) => { const ys = [...xs]; const j = i + by; if (j < 0 || j >= ys.length) return xs; [ys[i], ys[j]] = [ys[j], ys[i]]; return ys; }); setDirty(true); };

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-center gap-2">
        <span className="shrink-0 rounded-md bg-accent px-2 py-0.5 text-[12px] font-bold text-black">Day {d.day}</span>
        <input value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} aria-label={`Day ${d.day} name`} className={`${input} min-w-0 flex-1 font-semibold`} />
      </div>
      {picking
        ? <WorkoutPicker day={d.day} onPick={(w) => start(async () => {
            const r = await copyWorkoutInto(clientId, d.workoutId, w.id);
            if (r?.error) setMsg(r.error); else { setPicking(false); setMsg(`Day ${d.day} is now “${w.name}” ✓`); router.refresh(); }
          })} onClose={() => setPicking(false)} busy={pending} />
        : <button type="button" onClick={() => setPicking(true)} className="min-h-10 w-full rounded-xl border border-border text-[13px] font-semibold">📋 Use a ready workout (Trainerize)</button>}
      <ol className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="space-y-1.5 rounded-xl border border-[#242424] bg-bg/60 p-2.5">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 w-5 shrink-0 text-[13px] text-dim">{i + 1}.</span>
              <span className="min-w-0 flex-1 text-[14px] font-semibold">{it.name}{!it.video && <span className="ml-1 text-[11px] font-normal text-dim">(no video)</span>}</span>
              <button type="button" onClick={() => move(i, -1)} aria-label="Move up" className="grid size-8 place-items-center rounded-md border border-border text-[12px]">▲</button>
              <button type="button" onClick={() => move(i, 1)} aria-label="Move down" className="grid size-8 place-items-center rounded-md border border-border text-[12px]">▼</button>
              <button type="button" onClick={() => { setItems((xs) => xs.filter((_, k) => k !== i)); setDirty(true); }} aria-label={`Remove ${it.name}`} className="grid size-8 place-items-center rounded-md border border-border text-[var(--red)]">✕</button>
            </div>
            <div className="flex flex-wrap gap-1.5 pl-7">
              <label className="flex items-center gap-1 text-[12px] text-dim">Sets<input type="number" min={1} max={20} value={it.sets} onChange={(e) => set(i, { sets: Number(e.target.value) })} className={`${input} w-14`} /></label>
              <label className="flex min-w-[9rem] flex-1 items-center gap-1 text-[12px] text-dim">Reps / target<input value={it.target} onChange={(e) => set(i, { target: e.target.value })} placeholder="8–10 reps" className={`${input} min-w-0 flex-1`} /></label>
              <label className="flex items-center gap-1 text-[12px] text-dim">Rest<input type="number" min={0} step={15} value={it.rest_seconds ?? ""} onChange={(e) => set(i, { rest_seconds: e.target.value === "" ? null : Number(e.target.value) })} placeholder="90" className={`${input} w-16`} />s</label>
              <select value={it.log_type} onChange={(e) => set(i, { log_type: e.target.value })} aria-label="What she logs" className={input}>
                {LOGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                {!LOGS.some(([v]) => v === it.log_type) && <option value={it.log_type}>{it.log_type}</option>}
              </select>
            </div>
          </li>
        ))}
        {!items.length && <li className="text-[13px] text-dim">No exercises yet.</li>}
      </ol>
      {adding
        ? <ExercisePicker onPick={(e) => { setItems((xs) => [...xs, { exercise_id: e.id, name: e.name, video: e.video, sets: 3, target: "8–10 reps", rest_seconds: 90, log_type: "strength" }]); setDirty(true); }} onClose={() => setAdding(false)} />
        : <button type="button" onClick={() => setAdding(true)} className="min-h-10 w-full rounded-xl border border-dashed border-[#3a3a3a] text-[13px] text-accent">+ Add an exercise</button>}
      <div className="flex items-center gap-2">
        <button type="button" disabled={!dirty || pending} onClick={() => start(async () => {
          const r = await saveDay(clientId, d.workoutId, name, items.map(({ exercise_id, sets, target, rest_seconds, log_type }) => ({ exercise_id, sets, target, rest_seconds, log_type })));
          if (r?.error) setMsg(r.error); else { setMsg("Saved ✓"); setDirty(false); router.refresh(); }
        })} className="min-h-11 flex-1 rounded-xl bg-accent text-[14px] font-semibold text-black disabled:opacity-40">{pending ? "Saving…" : dirty ? `Save Day ${d.day}` : "Saved"}</button>
        {msg && <span className="text-[13px] text-dim">{msg}</span>}
      </div>
    </div>
  );
}

type Found = { id: number; name: string; video: boolean };
function ExercisePicker({ onPick, onClose }: { onPick: (e: Found) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [making, setMaking] = useState(false);
  const [nn, setNn] = useState({ name: "", notes: "", youtube: "" });
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => {
    const t = setTimeout(() => { if (q.trim().length >= 2) searchExercises(q).then(setFound); }, 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="space-y-2 rounded-xl border border-accent/50 bg-bg p-2.5">
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Search exercises: leg press, RDL, lat pulldown…" aria-label="Search exercises" className={`${input} min-w-0 flex-1`} />
        <button type="button" onClick={onClose} className="min-h-10 px-2 text-[13px] text-dim">Done</button>
      </div>
      {q.trim().length >= 2 && (
        <ul className="max-h-64 divide-y divide-[#222] overflow-y-auto rounded-lg border border-[#222]">
          {found.map((e) => (
            <li key={e.id}><button type="button" onClick={() => onPick(e)} className="flex min-h-10 w-full items-center justify-between gap-2 px-2.5 text-left text-[14px] hover:bg-[#1a1a1a]">
              <span>{e.name}</span><span className="shrink-0 text-[11px] text-dim">{e.video ? "▶ video" : ""} +</span></button></li>
          ))}
          {!found.length && <li className="px-2.5 py-2 text-[13px] text-dim">Nothing found.</li>}
        </ul>
      )}
      {!making ? <button type="button" onClick={() => { setMaking(true); setNn({ ...nn, name: q }); }} className="text-[13px] text-accent underline">Not in the library? Add a new exercise</button> : (
        <div className="space-y-1.5 rounded-lg border border-[#2a2a2a] p-2">
          <input value={nn.name} onChange={(e) => setNn({ ...nn, name: e.target.value })} placeholder="Exercise name" aria-label="New exercise name" className={`${input} w-full`} />
          <textarea value={nn.notes} onChange={(e) => setNn({ ...nn, notes: e.target.value })} rows={2} placeholder="How to do it (optional)" aria-label="How to do it" className="w-full rounded-lg border border-[#2a2a2a] bg-bg p-2 text-[14px] outline-none focus:border-accent" />
          <input value={nn.youtube} onChange={(e) => setNn({ ...nn, youtube: e.target.value })} placeholder="YouTube link (optional)" aria-label="YouTube link" className={`${input} w-full`} />
          {err && <p className="text-sm text-[var(--red)]">{err}</p>}
          <button type="button" disabled={pending || !nn.name.trim()} onClick={() => start(async () => {
            const r = await addExercise(nn.name, nn.notes, nn.youtube);
            if ("error" in r && r.error) { setErr(r.error); return; }
            if ("exercise" in r && r.exercise) { onPick(r.exercise); setMaking(false); setNn({ name: "", notes: "", youtube: "" }); }
          })} className="min-h-10 w-full rounded-lg bg-accent text-[13px] font-semibold text-black disabled:opacity-50">{pending ? "Adding…" : "Add it"}</button>
        </div>
      )}
    </div>
  );
}

type FoundW = Awaited<ReturnType<typeof findWorkouts>>[number];
/** November 15: pick one of the workouts already in the app (Trainerize imports): browse a program, or search by name. */
function WorkoutPicker({ day, onPick, onClose, busy }: { day: number; onPick: (w: FoundW) => void; onClose: () => void; busy: boolean }) {
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);
  const [prog, setProg] = useState<string>("");
  const [q, setQ] = useState("");
  const [list, setList] = useState<FoundW[] | null>(null);
  const [sure, setSure] = useState<FoundW | null>(null);
  useEffect(() => { listPrograms().then(setPrograms); }, []);
  useEffect(() => {
    if (!prog && q.trim().length < 2) return;
    const t = setTimeout(() => { findWorkouts(prog || null, q).then(setList); }, 250);
    return () => clearTimeout(t);
  }, [prog, q]);
  return (
    <div className="space-y-2 rounded-xl border border-accent/50 bg-bg p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold">Pick a workout for Day {day}</p>
        <button type="button" onClick={onClose} className="min-h-9 px-2 text-[13px] text-dim">Cancel</button>
      </div>
      <select value={prog} onChange={(e) => { setProg(e.target.value); setList(null); }} aria-label="Program" className={`${input} w-full`}>
        <option value="">All programs (search below)</option>
        {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={prog ? "Filter by name (optional)" : "Search workouts by name: lower body, push, glutes…"} aria-label="Search workouts" className={`${input} w-full`} />
      {list && (
        <ul className="max-h-80 overflow-y-auto rounded-lg border border-[#222]">
          {list.map((w, i) => {
            const head = w.phase && w.phase !== list[i - 1]?.phase ? w.phase : null;
            return (
              <li key={w.id}>
                {head && <p className="sticky top-0 bg-[#141414] px-2.5 py-1 text-[11px] uppercase tracking-[0.1em] text-accent">{head}</p>}
                <button type="button" onClick={() => setSure(w)} className={`block w-full border-t border-[#1d1d1d] px-2.5 py-2 text-left hover:bg-[#1a1a1a] ${sure?.id === w.id ? "bg-[#1f1a10]" : ""}`}>
                  <span className="block text-[14px] font-semibold">{w.name}{w.day ? <span className="ml-1 text-[11px] font-normal text-dim">· Day {w.day}</span> : null}</span>
                  <span className="block truncate text-[12px] text-dim">{w.count} exercises · {w.preview}</span>
                </button>
              </li>
            );
          })}
          {!list.length && <li className="px-2.5 py-2 text-[13px] text-dim">No workouts found.</li>}
        </ul>
      )}
      {sure && (
        <div className="space-y-1.5 rounded-lg border border-accent/60 p-2">
          <p className="text-[13px]">Replace Day {day} with <b>{sure.name}</b> ({sure.count} exercises)? You can still change it after.</p>
          <button type="button" disabled={busy} onClick={() => onPick(sure)} className="min-h-10 w-full rounded-lg bg-accent text-[13px] font-semibold text-black disabled:opacity-50">{busy ? "Copying…" : `Use it for Day ${day}`}</button>
        </div>
      )}
    </div>
  );
}
