"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { celebrate, play, primeSounds } from "@/lib/celebrate";
import { finishWorkout, logSet, reopenWorkout, searchExercises, startSession, suggestExercises } from "../actions";

type SetVals = { weight?: number | null; reps?: number | null; seconds?: number | null; note?: string | null };
export type PlayerItem = {
  position: number; sets: number; target: string | null; seconds: number | null; rest: number | null; logType: string;
  exerciseId: number; name: string; notes: string | null; youtube: string | null; clip: string | null; poster: string | null;
  last: ({ set_no: number } & SetVals)[]; lastWhen: string | null; logged: ({ set_no: number } & SetVals)[];
};
type Props = {
  workout: { id: number; name: string; title: string; kind: "strength" | "cardio"; circuit: boolean; rounds: number | null; minutes: number | null; notes: string | null };
  phase: { name: string; week: number; weeks: number; color: string; label: string } | null;
  overview: { youtube: string; notes: string | null } | null;
  steps: PlayerItem[];
  session: { id: string; completed: boolean } | null;
  preview: boolean;
  ahead?: number; // next week's training week, when she's starting it early
};

const display = "font-[family-name:var(--font-display)] uppercase";
const key = (pos: number, set: number) => `${pos}:${set}`;
const yt = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
/** What she types into a time box: "90" or "90s" → 90 s, "1:30" → 90 s, "2m" or "2 min" → 120 s. */
const toSeconds = (s: string) => {
  const t = s.trim().toLowerCase();
  if (!t) return null;
  let m = t.match(/^(\d+):(\d{1,2})$/); if (m) return +m[1] * 60 + +m[2];
  m = t.match(/^(\d+(?:\.\d+)?)\s*(m|min|mins|minutes?)$/); if (m) return Math.round(+m[1] * 60);
  m = t.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds?)?$/); if (m) return Math.round(+m[1]);
  return null;
};
const nowMs = () => Date.now();
const mmss = (n: number) => `${Math.floor(n / 60)}:${String(Math.round(n % 60)).padStart(2, "0")}`;

/** How a set is logged for each kind of exercise. */
function fieldsFor(t: string): ("weight" | "reps" | "seconds" | "note")[] {
  if (t === "strength") return ["weight", "reps"];
  if (t === "endurance") return ["reps"];
  if (t === "timedStrength") return ["weight", "note"];
  if (t === "timedLongerBetter" || t === "timedFasterBetter" || t === "cardio") return ["seconds"];
  return [];
}
const LABEL = { weight: "lb", reps: "reps", seconds: "time", note: "time / distance" } as const;
function describe(s: SetVals) {
  return [s.weight != null ? `${s.weight} lb` : null, s.reps != null ? `${s.reps} reps` : null, s.seconds != null ? mmss(s.seconds) : null, s.note || null].filter(Boolean).join(" × ");
}

type Sub = { id: number; name: string; notes: string | null; clip: string | null; poster: string | null; youtube: string | null; last: PlayerItem["last"]; lastWhen: string | null };
type Original = { name: string };

export default function Player({ workout, phase, overview, steps: baseSteps, session, preview, ahead }: Props) {
  // Substitutes (November 2): she can swap any exercise for another one. Remembered on this phone for this workout;
  // the sets she logs are saved under the exercise she actually did.
  const subKey = `dwtp-subs:${session?.id ?? `w${workout.id}`}`;
  const [subs, setSubs] = useState<Record<number, Sub>>({});
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem(subKey) ?? "{}"); if (v && typeof v === "object") setSubs(v); } catch {} }, [subKey]); // eslint-disable-line react-hooks/set-state-in-effect -- read once
  const setSub = (position: number, sub: Sub | null) => setSubs((cur) => {
    const next = { ...cur };
    if (sub) next[position] = sub; else delete next[position];
    try { localStorage.setItem(subKey, JSON.stringify(next)); } catch {}
    return next;
  });
  const steps = useMemo(() => baseSteps.map((s): PlayerItem & { original?: Original } => {
    const x = subs[s.position];
    return x ? { ...s, exerciseId: x.id, name: x.name, notes: x.notes, clip: x.clip, poster: x.poster, youtube: x.youtube, last: x.last, lastWhen: x.lastWhen, original: { name: s.name } } : s;
  }), [baseSteps, subs]);
  const [step, setStep] = useState<number>(-1); // -1 = start screen, steps.length = finished
  const [sound, setSound] = useState(false); // clips start muted; one tap turns the sound on (November 1)
  const [sessionId, setSessionId] = useState<string | null>(session?.id ?? null);
  // A time box keeps exactly what she types ("1:3" on the way to "1:30") until she leaves it (October 30 fix).
  const [timeText, setTimeText] = useState<Record<string, string>>({});
  // November 5: what she's typing in weight/reps, as typed, so "27." stays while she types 27.5 (it used to snap back to 27).
  const [numText, setNumText] = useState<Record<string, string>>({});
  const [vals, setVals] = useState<Record<string, SetVals & { done?: boolean }>>(() => {
    const v: Record<string, SetVals & { done?: boolean }> = {};
    for (const s of steps) for (const l of s.logged) v[key(s.position, l.set_no)] = { ...l, done: true };
    return v;
  });
  // November 10 (Esmeralda): extra sets beyond the program's, per exercise. A resumed workout keeps any she logged.
  const [extra, setExtra] = useState<Record<number, number>>(() =>
    Object.fromEntries(steps.map((s) => [s.position, Math.max(0, ...s.logged.map((l) => l.set_no - s.sets))])));
  const [rest, setRest] = useState<{ ends: number; total: number } | null>(null);
  const [now, setNow] = useState(nowMs);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ cps: number } | null>(session?.completed ? { cps: 0 } : null);
  const finishRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // November 2: keep the screen on during a workout (it kept going dark between sets). The phone lets go of it
  // when she leaves the app, so ask again when she comes back.
  const inWorkout = step >= 0 && step < steps.length;
  useEffect(() => {
    if (!inWorkout) return;
    type Lock = { release: () => Promise<void> };
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Lock> } }).wakeLock;
    if (!wl) return;
    let lock: Lock | null = null, gone = false;
    const get = () => { if (document.visibilityState === "visible") wl.request("screen").then((l) => { if (gone) void l.release(); else lock = l; }).catch(() => {}); };
    get();
    document.addEventListener("visibilitychange", get);
    return () => { gone = true; document.removeEventListener("visibilitychange", get); void lock?.release().catch(() => {}); };
  }, [inWorkout]);

  // November 3: a workout clock (time since she tapped Start), kept for this workout on this phone.
  const clockKey = `dwtp-clock:${session?.id ?? `w${workout.id}`}`;
  const [startedAt, setStartedAt] = useState<number | null>(null);
  useEffect(() => { try { const v = Number(localStorage.getItem(clockKey)); if (v > 0 && Date.now() - v < 6 * 3_600_000) setStartedAt(v); } catch {} }, [clockKey]); // eslint-disable-line react-hooks/set-state-in-effect -- read once
  useEffect(() => {
    if (!inWorkout) return;
    const t = setInterval(() => setNow(nowMs()), 1000);
    return () => clearInterval(t);
  }, [inWorkout]);
  const startClock = () => {
    if (startedAt) return;
    const t = nowMs(); setStartedAt(t);
    try { localStorage.setItem(clockKey, String(t)); } catch {}
  };
  const hms = (secs: number) => { const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = Math.floor(secs % 60); return `${h ? `${h}:` : ""}${h ? String(m).padStart(2, "0") : m}:${String(s).padStart(2, "0")}`; };

  // Rest timer tick, and a sound + buzz when it runs out.
  useEffect(() => {
    if (!rest) return;
    const t = setInterval(() => {
      const n = nowMs(); setNow(n);
      if (n >= rest.ends) { clearInterval(t); setRest(null); play("rest-over"); try { navigator.vibrate?.([120, 60, 120]); } catch {} }
    }, 250);
    return () => clearInterval(t);
  }, [rest]);

  const doneSets = useMemo(() => Object.values(vals).filter((v) => v.done).length, [vals]);
  const totalSets = steps.reduce((n, s) => n + (fieldsFor(s.logType).length ? s.sets : 1), 0);
  const stepDone = (s: PlayerItem) => {
    const n = fieldsFor(s.logType).length ? s.sets : 1;
    return Array.from({ length: n }, (_, i) => vals[key(s.position, i + 1)]?.done).every(Boolean);
  };

  async function begin() {
    primeSounds(["set-done", "rest-over"]);
    startClock();
    if (preview) { setStep(0); return; }
    setBusy(true); setError("");
    const r = await startSession(workout.id, ahead);
    setBusy(false);
    if ("error" in r && r.error) { setError(r.error); return; }
    if ("id" in r && r.id) setSessionId(r.id);
    setStep(0);
  }

  async function toggleSet(s: PlayerItem, setNo: number) {
    const k = key(s.position, setNo);
    const cur = vals[k] ?? {};
    const done = !cur.done;
    // An empty box takes last time's number, then the target, so one tap logs "same as last time".
    const lastSet = s.last.find((l) => l.set_no === setNo) ?? s.last[s.last.length - 1];
    const filled: SetVals = { ...cur };
    for (const f of fieldsFor(s.logType)) if (filled[f] == null || filled[f] === "") filled[f] = (lastSet?.[f] as never) ?? (f === "reps" && s.target && /^\d+$/.test(s.target) ? Number(s.target) : null);
    setVals((v) => ({ ...v, [k]: { ...filled, done } }));
    if (done) {
      play("set-done");
      // November 2: rest after every set, the last one too (she rests before the next exercise).
      if (s.rest) setRest({ ends: nowMs() + s.rest * 1000, total: s.rest });
    }
    if (!sessionId || preview) return;
    const r = await logSet(sessionId, s.position, setNo, s.exerciseId, { ...filled, done });
    if (r?.error) setError(r.error);
  }

  async function finish() {
    if (preview || !sessionId) { setStep(steps.length); return; }
    setBusy(true);
    const r = await finishWorkout(sessionId);
    setBusy(false);
    if ("error" in r && r.error) { setError(r.error); return; }
    setResult({ cps: ("cps" in r ? r.cps : 0) ?? 0 });
    try { localStorage.removeItem(clockKey); } catch {}
    setStep(steps.length);
    setTimeout(() => celebrate("quiz-passed", finishRef.current), 150);
  }

  async function reopen() {
    if (!sessionId) return;
    setBusy(true);
    const r = await reopenWorkout(sessionId);
    setBusy(false);
    if ("error" in r && r.error) { setError(r.error); return; }
    setResult(null);
    setStep(-1);
    router.refresh();
  }

  // Personal bests: heavier than anything she logged last time on that exercise.
  const prs = useMemo(() => steps.flatMap((s) => {
    if (!fieldsFor(s.logType).includes("weight")) return [];
    const best = Math.max(0, ...Object.entries(vals).filter(([k, v]) => k.startsWith(`${s.position}:`) && v.done).map(([, v]) => Number(v.weight) || 0));
    const before = Math.max(0, ...s.last.map((l) => Number(l.weight) || 0));
    return best > 0 && before > 0 && best > before ? [{ name: s.name, from: before, to: best }] : [];
  }), [steps, vals]);

  const shell = "fixed inset-0 z-30 flex flex-col bg-bg";
  const header = (
    <div className="mx-auto flex w-full max-w-md items-center gap-3 px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <Link href="/workouts" aria-label="Close workout" className="grid size-11 shrink-0 place-items-center rounded-full text-[#a8a8a8]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </Link>
      {step >= 0 && step < steps.length ? (
        <div className="flex flex-1 gap-1" aria-label={`Exercise ${step + 1} of ${steps.length}`}>
          {steps.map((s, i) => (
            <button key={s.position} type="button" onClick={() => setStep(i)} aria-label={`Go to ${s.name}`}
              className={`h-1.5 flex-1 rounded-full ${i === step ? "bg-accent" : stepDone(s) ? "bg-accent/50" : "bg-[#2a2a2a]"}`} />
          ))}
        </div>
      ) : <p className={`${display} flex-1 text-center text-lg`}>{step === -1 && !result ? "" : workout.title}</p>}
      <span className="w-11 shrink-0 text-right text-[13px] tabular-nums text-dim">{step >= 0 && step < steps.length ? `${step + 1}/${steps.length}` : ""}</span>
    </div>
  );

  // ── Start screen ──────────────────────────────────────────
  if (step === -1 && !result) {
    return (
      <div className={shell}>
        {header}
        <div className="mx-auto w-full max-w-md flex-1 space-y-4 overflow-y-auto px-4 pb-6 pt-2">
          {phase && (
            <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.12em] text-[#bdbdbd]">
              <span className="rounded-full px-2 py-0.5 font-bold text-black" style={{ background: phase.color }}>{phase.label}</span>
              {phase.name} · week {phase.week} of {phase.weeks}
            </div>
          )}
          <div>
            <h1 className={`${display} text-[40px] leading-none`}>{workout.kind === "cardio" ? workout.title : workout.title}</h1>
          </div>
          {preview && <p className="rounded-[14px] border border-[#2b2418] bg-[#161310] p-3 text-[13px] text-[#d9c9a8]">Preview. You can look through it, but sets are saved once this week of your program starts.</p>}
          {overview && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Watch this first</p>
              <div className="aspect-video overflow-hidden rounded-[16px] bg-black">
                <iframe src={yt(overview.youtube)} title="Workout overview" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen className="size-full" />
              </div>
              <p className="text-[13px] leading-snug text-dim">Michael walks through every exercise. Then each one has a short clip to remind you.</p>
            </div>
          )}
          <ol className="divide-y divide-border rounded-[18px] border border-border bg-card">
            {steps.map((s, i) => (
              <li key={s.position}>
                <button type="button" onClick={() => (sessionId || preview ? setStep(i) : undefined)} className="flex w-full items-center gap-3 p-2.5 text-left">
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-[12px] bg-[#1b1b1b]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- poster */}
                    {s.poster && <img src={s.poster} alt="" className="size-full object-cover" />}
                    <span className="absolute bottom-0.5 left-1 text-[11px] font-bold text-white drop-shadow">{i + 1}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium leading-snug">{s.name}</span>
                    <span className="block text-[12px] text-dim">{summary(s)}</span>
                  </span>
                  {stepDone(s) && sessionId && <span className="text-[#22c55e]">✓</span>}
                </button>
              </li>
            ))}
          </ol>
          {workout.notes && <p className="whitespace-pre-line text-[13px] text-dim">{workout.notes}</p>}
        </div>
        <Bottom>
          {error && <p className="mb-2 text-sm text-[var(--red)]">{error}</p>}
          <button type="button" disabled={busy} onClick={begin} className="min-h-[56px] w-full rounded-[16px] bg-accent text-[18px] font-semibold text-black disabled:opacity-50">
            {busy ? "Starting…" : doneSets > 0 ? "Continue workout" : "Start workout"}
          </button>
        </Bottom>
      </div>
    );
  }

  // ── Finished ──────────────────────────────────────────────
  if (step >= steps.length || (result && step === -1)) {
    return (
      <div className={shell}>
        {header}
        <div ref={finishRef} className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="52" fill="none" stroke="#2a2a2a" strokeWidth="10" />
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--accent,#f5a623)" strokeWidth="10" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 52}`} strokeDashoffset="0" transform="rotate(-90 60 60)" />
            <path d="M40 61l13 13 27-29" fill="none" stroke="var(--accent,#f5a623)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h1 className={`${display} text-[36px] leading-none`}>{preview ? "That's the workout" : "Workout done"}</h1>
          <p className="text-[15px] text-[#bdbdbd]">{workout.title}{phase ? ` · ${phase.name}` : ""}</p>
          {!preview && (
            <div className="grid w-full grid-cols-2 gap-2.5">
              <div className="rounded-[16px] border border-border bg-card p-3"><p className={`${display} text-[28px] leading-none`}>{doneSets}</p><p className="mt-1 text-[12px] text-dim">{doneSets === 1 ? "set" : "sets"} logged</p></div>
              <div className="rounded-[16px] border border-border bg-card p-3"><p className={`${display} text-[28px] leading-none text-accent`}>+{result?.cps ?? 0}</p><p className="mt-1 text-[12px] text-dim">CPs</p></div>
            </div>
          )}
          {prs.length > 0 && (
            <div className="w-full rounded-[16px] border border-[#3a2f12] bg-[#1a150a] p-3 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">New personal best{prs.length > 1 ? "s" : ""}</p>
              {prs.map((p) => <p key={p.name} className="mt-1 text-[14px]">{p.name}: <span className="text-dim">{p.from} →</span> <b>{p.to} lb</b></p>)}
            </div>
          )}
          <Link href="/workouts" className="mt-2 min-h-[52px] w-full rounded-[16px] bg-accent py-3.5 text-[17px] font-semibold text-black">Back to workouts</Link>
          {/* November 11: marked done by mistake? Take it back. */}
          {!preview && sessionId && (
            <button type="button" disabled={busy} onClick={reopen} className="min-h-11 px-3 text-[14px] text-[#a8a8a8] underline disabled:opacity-50">
              {busy ? "Reopening…" : "Marked done by mistake? Reopen this workout"}
            </button>
          )}
          {error && <p className="text-sm text-[var(--red)]">{error}</p>}
        </div>
      </div>
    );
  }

  // ── One exercise ─────────────────────────────────────────
  const s = steps[step];
  const fields = fieldsFor(s.logType);
  const rows = fields.length ? s.sets + (extra[s.position] ?? 0) : 1;
  const last = step === steps.length - 1;
  const extraLast = (extra[s.position] ?? 0) > 0 && !vals[key(s.position, rows)]?.done;
  const left = rest ? Math.max(0, (rest.ends - now) / 1000) : 0;
  return (
    <div className={shell}>
      {header}
      {/* November 3: workout clock, and a timer she can start any time (for holds, timed sets or her own rest). */}
      <div className="mx-auto flex w-full max-w-md items-center justify-between gap-2 px-4 pt-1.5 text-[13px]">
        <span className="tabular-nums text-[#cfcfcf]">⏱ {startedAt ? hms(Math.max(0, (now - startedAt) / 1000)) : "0:00"}<span className="ml-1 text-[11px] text-dim">workout</span></span>
        {!rest && (
          <span className="flex items-center gap-1">
            <span className="text-[11px] text-dim">Timer</span>
            {[30, 60, 90, 120].map((secs) => (
              <button key={secs} type="button" onClick={() => { primeSounds(["rest-over"]); setRest({ ends: nowMs() + secs * 1000, total: secs }); }}
                className="min-h-8 rounded-full border border-[#3a3a3a] px-2.5 text-[12px] font-semibold tabular-nums">{secs < 60 ? `${secs}s` : mmss(secs)}</button>
            ))}
          </span>
        )}
      </div>
      {/* Rest timer: a ring that empties, with skip and +15 s. Pinned at the top, and it keeps going when she moves to the next exercise. */}
      {rest && (
        <div className="mx-auto mt-2 flex w-[calc(100%-2rem)] max-w-md items-center gap-3 rounded-[18px] border border-accent/60 bg-[#161310] p-2.5" role="timer" aria-live="polite">
          <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
            <circle cx="26" cy="26" r="22" fill="none" stroke="#2a2a2a" strokeWidth="5" />
            <circle cx="26" cy="26" r="22" fill="none" stroke="var(--accent,#f5a623)" strokeWidth="5" strokeLinecap="round" transform="rotate(-90 26 26)"
              strokeDasharray={`${2 * Math.PI * 22}`} strokeDashoffset={`${2 * Math.PI * 22 * (1 - left / rest.total)}`} />
          </svg>
          <div className="flex-1">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#d9c9a8]">Rest</p>
            <p className={`${display} text-[26px] leading-none tabular-nums`}>{mmss(Math.ceil(left))}</p>
          </div>
          <button type="button" onClick={() => setRest({ ends: rest.ends + 15000, total: rest.total + 15 })} className="min-h-11 rounded-[12px] border border-[#3a3022] px-3 text-[14px]">+15 s</button>
          <button type="button" onClick={() => setRest(null)} className="min-h-11 rounded-[12px] bg-accent px-3.5 text-[14px] font-semibold text-black">Skip</button>
        </div>
      )}

      <div className="mx-auto w-full max-w-md flex-1 space-y-3.5 overflow-y-auto px-4 pb-6 pt-2">
        <div className="relative aspect-video overflow-hidden rounded-[18px] bg-black">
          {s.clip ? (
            <>
              <video key={s.clip} src={s.clip} poster={s.poster ?? undefined} autoPlay muted={!sound} loop playsInline preload="auto" className="size-full object-cover" />
              <button type="button" onClick={() => setSound((x) => !x)} aria-pressed={sound} aria-label={sound ? "Turn sound off" : "Turn sound on"}
                className="absolute bottom-2 right-2 flex min-h-9 items-center gap-1.5 rounded-full bg-black/65 px-3 text-[12px] font-semibold text-white backdrop-blur">
                {sound ? "🔊 Sound on" : "🔇 Tap for sound"}
              </button>
            </>
          ) : s.youtube ? (
            // November 1: a full YouTube player (with sound and controls). The old muted loop had no way to unmute,
            // so mobility routines and other talking videos were silent unless opened on YouTube.
            <iframe key={s.youtube} src={yt(s.youtube)} title={s.name} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="size-full" />
          ) : <div className="grid size-full place-items-center text-dim">No video</div>}
        </div>

        <div>
          <h2 className={`${display} text-[26px] leading-tight`}>{s.name}</h2>
          <Substitute key={s.position} current={s.name} original={(s as { original?: Original }).original ?? null}
            onPick={(x) => setSub(s.position, x)} onUndo={() => setSub(s.position, null)} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip strong>{summary(s)}</Chip>
            {s.rest ? <Chip>Rest {s.rest >= 60 ? mmss(s.rest) : `${s.rest} s`}</Chip> : null}
            {s.logType === "timedFasterBetter" && <Chip>Faster is better</Chip>}
            {s.logType === "timedLongerBetter" && <Chip>Longer is better</Chip>}
          </div>
          {s.last.length > 0 && (
            <p className="mt-2 text-[13px] text-[#a8a8a8]">Last time: <span className="text-text">{s.last.map(describe).filter(Boolean).join(" · ") || "done"}</span></p>
          )}
        </div>

        <div className="space-y-2">
          {Array.from({ length: rows }, (_, i) => {
            const n = i + 1, k = key(s.position, n), v = vals[k] ?? {};
            const lastSet = s.last.find((l) => l.set_no === n);
            return (
              <div key={k} className={`flex items-center gap-2 rounded-[14px] border p-2 ${v.done ? "border-[#24452c] bg-[#0f1a11]" : "border-border bg-card"}`}>
                <span className="w-12 shrink-0 pl-1 text-[12px] uppercase tracking-[0.1em] text-dim">{fields.length ? `Set ${n}` : "Done?"}</span>
                <div className="flex flex-1 gap-2">
                  {fields.map((f) => (
                    // November 5: the unit sits above the number, so the box has room for 3+ digits (120, 1:30, 2.5 mi).
                    <label key={f} className="flex min-w-[4.25rem] flex-1 flex-col rounded-[10px] border border-[#2a2a2a] bg-bg px-2.5 pt-1">
                      <span className="text-[10px] leading-none text-dim">{LABEL[f]}</span>
                      <input aria-label={`Set ${n} ${LABEL[f]}`} disabled={v.done} inputMode={f === "note" || f === "seconds" ? "text" : f === "weight" ? "decimal" : "numeric"}
                        value={f === "seconds" ? (timeText[k] ?? (v.seconds != null ? mmss(v.seconds) : ""))
                          : f === "note" ? ((v.note ?? "") as string) : (numText[`${k}:${f}`] ?? (v[f] ?? "")) as string | number}
                        onBlur={() => {
                          if (f === "seconds") setTimeText((t) => { const n = { ...t }; delete n[k]; return n; });
                          if (f === "weight" || f === "reps") setNumText((t) => { const n = { ...t }; delete n[`${k}:${f}`]; return n; });
                        }}
                        placeholder={f === "seconds" ? (lastSet?.seconds != null ? mmss(lastSet.seconds) : s.seconds ? mmss(s.seconds) : "m:ss") : String(lastSet?.[f] ?? (f === "reps" && s.target && /^\d+$/.test(s.target) ? s.target : "–"))}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (f === "seconds") setTimeText((t) => ({ ...t, [k]: raw }));
                          if (f === "weight" || f === "reps") setNumText((t) => ({ ...t, [`${k}:${f}`]: raw }));
                          const num = Number(raw.replace(",", "."));
                          setVals((x) => ({ ...x, [k]: { ...x[k], [f]: f === "note" ? raw : f === "seconds" ? toSeconds(raw) : raw === "" || Number.isNaN(num) ? null : num } }));
                        }}
                        className="min-h-9 w-full min-w-0 bg-transparent text-[17px] font-semibold tabular-nums outline-none placeholder:font-normal placeholder:text-[#5a5a5a] disabled:text-[#b7e4c0]" />
                    </label>
                  ))}
                  {!fields.length && <span className="self-center text-[14px] text-[#a8a8a8]">{s.youtube && !s.clip ? "Follow along, then check it off" : "Check it off when you're done"}</span>}
                </div>
                <button type="button" onClick={() => toggleSet(s, n)} aria-pressed={!!v.done} aria-label={v.done ? `Undo set ${n}` : `Log set ${n}`}
                  className={`grid size-12 shrink-0 place-items-center rounded-[12px] ${v.done ? "bg-[#22c55e] text-black" : "border-2 border-accent text-accent"}`}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                </button>
              </div>
            );
          })}
          {/* November 10: one more set whenever she wants it (it doesn't change the program, just this workout). */}
          {fields.length > 0 && (
            <div className="flex gap-2">
              <button type="button" onClick={() => setExtra((x) => ({ ...x, [s.position]: (x[s.position] ?? 0) + 1 }))}
                className="min-h-11 flex-1 rounded-[12px] border border-dashed border-[#3a3a3a] text-[14px] font-semibold text-accent">+ Add a set</button>
              {extraLast && (
                <button type="button" onClick={() => setExtra((x) => ({ ...x, [s.position]: Math.max(0, (x[s.position] ?? 0) - 1) }))}
                  className="min-h-11 rounded-[12px] border border-[#3a3a3a] px-4 text-[14px] text-dim">Remove</button>
              )}
            </div>
          )}
        </div>

        {s.notes && (
          <details className="group rounded-[14px] border border-border bg-card">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3.5 text-[14px] font-semibold">
              Michael&apos;s tips
              <svg className="transition group-open:rotate-180" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </summary>
            <p className="whitespace-pre-line px-3.5 pb-3.5 text-[14px] leading-relaxed text-[#cfcfcf]">{s.notes}</p>
          </details>
        )}
        {error && <p className="text-sm text-[var(--red)]">{error}</p>}
      </div>

      <Bottom>
        <div className="flex gap-2">
          <button type="button" onClick={() => setStep(step - 1)} className="min-h-[54px] rounded-[16px] border border-border px-5 text-[16px]">{step === 0 ? "Start" : "Back"}</button>
          {last ? (
            <button type="button" disabled={busy} onClick={finish} className="min-h-[54px] flex-1 rounded-[16px] bg-accent text-[17px] font-semibold text-black disabled:opacity-50">
              {busy ? "Saving…" : preview ? "Finish preview" : `Finish workout${totalSets ? ` · ${doneSets}/${totalSets} sets` : ""}`}
            </button>
          ) : (
            <button type="button" onClick={() => setStep(step + 1)} className={`min-h-[54px] flex-1 rounded-[16px] text-[17px] font-semibold ${stepDone(s) ? "bg-accent text-black" : "border border-accent text-accent"}`}>
              Next: {steps[step + 1].name.length > 22 ? steps[step + 1].name.slice(0, 21) + "…" : steps[step + 1].name}
            </button>
          )}
        </div>
      </Bottom>
    </div>
  );
}

function summary(s: PlayerItem) {
  const fields = fieldsFor(s.logType);
  const t = s.target?.trim();
  if (!fields.length) return s.seconds && s.seconds > 30 ? mmss(s.seconds) : "Watch and follow along";
  if (s.logType === "cardio" || s.logType.startsWith("timed") && !t) return `${s.sets} × ${s.seconds ? mmss(s.seconds) : "timed"}`;
  return `${s.sets} ${s.sets === 1 ? "set" : "sets"}${t ? ` × ${t}` : ""}`;
}
function Chip({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return <span className={`rounded-full px-3 py-1 text-[13px] ${strong ? "bg-[#2a2a2a] font-semibold text-text" : "border border-[#2a2a2a] text-[#bdbdbd]"}`}>{children}</span>;
}
function Bottom({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-border bg-[#0f0f0f] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-md px-4 pt-3">{children}</div>
    </div>
  );
}

/**
 * ⇄ Substitute (November 2): type to search every exercise (names come up as she types, like the chat search),
 * tap one and it replaces this exercise for today.
 */
function Substitute({ current, original, onPick, onUndo }: {
  current: string; original: Original | null; onPick: (s: Sub) => void; onUndo: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Sub[]>([]);
  const [busy, setBusy] = useState(false);
  // November 3: similar exercises come up right away, before she types.
  const [ideas, setIdeas] = useState<Sub[] | null>(null);
  const base = original?.name ?? current;
  useEffect(() => {
    if (!open || ideas) return;
    let live = true;
    suggestExercises(base).then((r) => { if (live) setIdeas(r.filter((x) => x.name !== current)); }).catch(() => { if (live) setIdeas([]); });
    return () => { live = false; };
  }, [open, ideas, base, current]);
  useEffect(() => {
    if (!open || q.trim().length < 2) return;
    let live = true;
    const t = setTimeout(async () => {
      setBusy(true);
      const r = await searchExercises(q).catch(() => []);
      if (live) { setHits(r); setBusy(false); }
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [q, open]);
  const typing = q.trim().length >= 2;
  const shown = typing ? hits : ideas ?? [];
  return (
    <div className="mt-1.5">
      {original
        ? <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-[#a8a8a8]"><span>⇄ Instead of <b className="text-text">{original.name}</b></span>
            <button type="button" onClick={onUndo} className="min-h-8 text-accent underline underline-offset-2">Undo</button>
            <button type="button" onClick={() => setOpen(true)} className="min-h-8 text-accent underline underline-offset-2">Pick another</button></p>
        : !open && <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#3a3a3a] px-3 text-[13px] font-semibold text-[#cfcfcf]">⇄ Substitute</button>}
      {open && (
        <div className="mt-2 space-y-1.5 rounded-[14px] border border-border bg-card p-2.5">
          <div className="flex gap-2">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type an exercise to search"
              aria-label="Search exercises" className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#2a2a2a] bg-bg px-3 text-[16px] outline-none focus:border-accent" />
            <button type="button" onClick={() => { setOpen(false); setQ(""); }} className="min-h-11 px-2 text-sm text-dim">Cancel</button>
          </div>
          {busy && <p className="px-1 text-[12px] text-dim">Searching…</p>}
          {!typing && <p className="px-1 text-[12px] text-dim">{ideas === null ? "Finding similar exercises…" : ideas.length ? "Similar exercises, or type to search all of them:" : "Type to search every exercise."}</p>}
          <ul className="max-h-72 divide-y divide-border overflow-y-auto">
            {shown.map((x) => (
              <li key={x.id}>
                <button type="button" onClick={() => { onPick(x); setOpen(false); setQ(""); }} className="flex w-full items-center gap-3 py-2 text-left">
                  <span className="block size-11 shrink-0 overflow-hidden rounded-lg bg-[#1b1b1b]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- storage poster */}
                    {x.poster && <img src={x.poster} alt="" className="size-full object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold leading-snug">{x.name}</span>
                    {x.last.length > 0 && <span className="block text-[11px] text-dim">You&apos;ve done this before</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {q.trim().length >= 2 && !busy && !shown.length && <p className="px-1 text-[12px] text-dim">No exercise matches &ldquo;{q.trim()}&rdquo;.</p>}
        </div>
      )}
    </div>
  );
}
