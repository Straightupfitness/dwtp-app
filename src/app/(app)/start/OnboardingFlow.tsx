"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FieldInput } from "../checkin/CheckinFlow";
import { BLUEPRINT, UNLOCK } from "@/lib/blueprint";
import type { Screen } from "@/lib/checkin-screens";
import { saveBlueprint, submitBlueprint } from "./actions";

const display = "font-[family-name:var(--font-display)] uppercase";
type Answers = Record<string, unknown>;

function answered(s: Screen, a: Answers, vids: Record<string, string>) {
  return s.fields.every((f) => {
    if (f.optional || f.kind === "note" || f.kind === "multi") return true;
    const v = a[f.id];
    if (f.kind === "open") return !!vids[f.id] || (typeof v === "string" && !!v.trim());
    return v !== undefined && v !== "";
  });
}

/**
 * Onboarding in the app (November 10). Michael's welcome video (ONB-01) with three quick questions that unlock the
 * Driven Woman Blueprint, then the Blueprint itself: one question per screen with his 7X video, saved as she goes.
 */
export default function OnboardingFlow({ first, userId, videos, saved, preview = false }: {
  first: string; userId: string; videos: Record<string, string>; saved: Answers; preview?: boolean;
}) {
  const savedVids = (saved.videos ?? {}) as Record<string, string>;
  const startAt = Object.keys(saved).length ? Math.max(0, BLUEPRINT.findIndex((s) => !answered(s, saved, savedVids))) : -1;
  const [i, setI] = useState(startAt); // -1 = welcome video + unlock questions
  const [a, setA] = useState<Answers>(() => { const { videos: _v, ...rest } = saved; void _v; return rest; });
  const [vids, setVids] = useState<Record<string, string>>(savedVids);
  const [picks, setPicks] = useState<(string | null)[]>(UNLOCK.map(() => null));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [hh, setHh] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  // Shuffle each question's options once, so the right answer isn't always first.
  const shuffled = useMemo(() => UNLOCK.map((u, k) => [...u.options].sort((x, y) => ((x.length * 7 + k) % 5) - ((y.length * 7 + k) % 5))), []);
  const unlocked = picks.every((p, k) => p === UNLOCK[k].options[0]);
  const screen = i >= 0 ? BLUEPRINT[i] : null;

  function play(code: string | null) {
    const v = video.current;
    if (!v) return;
    const url = code ? videos[code] : null;
    if (!url) { v.pause(); v.removeAttribute("src"); v.load(); setPlaying(false); return; }
    if (v.src !== url) v.src = url;
    v.currentTime = 0; v.muted = false;
    v.play().then(() => setPlaying(true), () => setPlaying(false));
  }
  function go(n: number) {
    setError(""); setI(n); play(n >= 0 ? BLUEPRINT[n].code : null); window.scrollTo({ top: 0 });
    if (!preview && n > 0) void saveBlueprint({ ...a, videos: vids });
  }
  function next() {
    if (screen && !answered(screen, a, vids)) { setError("Answer this one first. You can type it or record a quick video."); return; }
    if (i === BLUEPRINT.length - 1) { void submit(); return; }
    go(i + 1);
  }
  async function submit() {
    if (preview) { setDone(true); return; }
    setBusy(true);
    const r = await submitBlueprint({ ...a, videos: vids });
    setBusy(false);
    if (r?.error) setError(r.error); else { setHh(("hh" in r && r.hh) || null); setDone(true); video.current?.pause(); }
  }

  if (done) return (
    <div className="space-y-3 rounded-[22px] border border-accent bg-[#1f1708] p-6 text-center">
      <p className={`${display} text-3xl font-semibold`}>You did it, {first}</p>
      <p className="text-[#d9c9a8]">Your Driven Woman Blueprint is in. Michael reads every answer and builds your plan from it.</p>
      <p className="text-[#d9c9a8]">Here&apos;s your head start: <b className="text-text">your Week 1 Habits &amp; Homework is open now</b>, so you&apos;re ready to go on day one. (We&apos;ve emailed you the link too.)</p>
      {preview ? <p className="text-sm text-dim">Preview only. Nothing was saved.</p> : (
        <div className="flex flex-col items-center gap-1.5">
          <Link href={hh ? `/lessons/${hh}` : "/lessons"} className="inline-grid min-h-12 w-full max-w-xs place-items-center rounded-xl bg-accent px-6 font-semibold text-black">Open my Week 1 Habits &amp; Homework</Link>
          <Link href="/today" className="min-h-11 px-3 py-2.5 text-sm text-[#d9c9a8] underline">Go to your app</Link>
        </div>
      )}
    </div>
  );

  const code = i < 0 ? "ONB-01" : screen?.code ?? null;
  const has = !!(code && videos[code]);
  return (
    <div className="space-y-4 pb-28">
      {i < 0 ? (
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-[0.15em] text-accent">Welcome, {first}</p>
          <h1 className={`${display} text-[30px] leading-none`}>Start here</h1>
          <p className="text-sm text-dim">Watch Michael&apos;s welcome video, then answer three quick questions to unlock your Driven Woman Blueprint.</p>
        </header>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between"><p className="text-xs uppercase tracking-[0.15em] text-accent">Driven Woman Blueprint</p><span className="text-[11px] text-dim">{i + 1} of {BLUEPRINT.length}</span></div>
          <div className="h-1 overflow-hidden rounded-full bg-[#262626]"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((i + 1) / BLUEPRINT.length) * 100}%` }} /></div>
        </div>
      )}

      {/* One player for everything, so the sound keeps working from screen to screen. ONB-01 is landscape, the rest portrait. */}
      <div className={has ? "relative mx-auto w-fit max-w-full" : "hidden"}>
        <video ref={video} playsInline preload="auto" src={i < 0 ? videos["ONB-01"] : undefined}
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
          onClick={(e) => { const v = e.currentTarget; if (v.paused) v.play(); else v.pause(); }}
          className={`block rounded-[20px] bg-black ${i < 0 ? "aspect-video w-full" : "h-[min(40dvh,500px)] w-auto max-w-full object-cover"}`} controls={i < 0 && playing} />
        {!playing && (
          <button type="button" onClick={() => { const v = video.current; if (!v) return; if (v.ended) v.currentTime = 0; v.muted = false; v.play(); }}
            aria-label="Play Michael's video" className="absolute inset-0 grid place-items-center rounded-[20px] bg-black/30">
            <span className="grid size-16 place-items-center rounded-full bg-accent text-2xl text-black">▶</span>
          </button>
        )}
      </div>

      {i < 0 && (
        <div className="space-y-3">
          {UNLOCK.map((u, k) => {
            const p = picks[k], right = u.options[0];
            return (
              <div key={u.q} role="group" aria-label={u.q} className="space-y-2 rounded-[18px] border border-border bg-card p-4">
                <p className="text-[15px] font-semibold">{k + 1}. {u.q}</p>
                <div className="flex flex-wrap gap-2">
                  {shuffled[k].map((o) => {
                    const chosen = p === o, ok = o === right;
                    return (
                      <button key={o} type="button" onClick={() => setPicks((x) => x.map((y, j) => (j === k ? o : y)))} aria-pressed={chosen}
                        className={`min-h-11 rounded-xl px-3.5 text-sm ${chosen ? (ok ? "bg-[#14532d] font-semibold text-[#7ee2a8]" : "bg-[#3b1219] text-[#fb7185]") : "border border-[#2a2a2a]"}`}>
                        {chosen ? (ok ? "✓ " : "✕ ") : ""}{o}
                      </button>
                    );
                  })}
                </div>
                {p && p !== right && <p className="text-[13px] text-[#fb7185]">Not quite. Try again. (Hint: it&apos;s in the video.)</p>}
              </div>
            );
          })}
        </div>
      )}

      {screen && (
        <div className="space-y-3">
          <h2 className="text-[20px] font-semibold leading-tight">{screen.title}</h2>
          {screen.fields.map((f) => (
            <FieldInput key={f.id} f={f} value={a[f.id]} circles={[]} onChange={(v) => { setError(""); setA((x) => ({ ...x, [f.id]: v })); }}
              video={vids[f.id] ?? null} onVideo={(p) => setVids((x) => { const y = { ...x }; if (p) y[f.id] = p; else delete y[f.id]; return y; })}
              folder={`${userId}/blueprint`} />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-[var(--red)]">{error}</p>}

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+57px)] z-10 border-t border-border bg-[#0f0f0f]/95 backdrop-blur">
        <div className="mx-auto flex max-w-md gap-2 px-4 py-3">
          {i > 0 && <button type="button" onClick={() => go(i - 1)} className="min-h-[52px] rounded-[14px] border border-border px-5">Back</button>}
          {i < 0
            ? <button type="button" disabled={!unlocked} onClick={() => go(0)} className="min-h-[52px] flex-1 rounded-[14px] bg-accent text-[16px] font-semibold text-black disabled:opacity-40">{unlocked ? "Start your Driven Woman Blueprint" : "Answer the 3 questions to unlock"}</button>
            : <button type="button" disabled={busy} onClick={next} className="min-h-[52px] flex-1 rounded-[14px] bg-accent text-[17px] font-semibold text-black disabled:opacity-50">{i === BLUEPRINT.length - 1 ? (busy ? "Sending…" : "Send my Blueprint") : "Next"}</button>}
        </div>
      </div>
    </div>
  );
}
