"use client";
import { useEffect, useRef, useState } from "react";
import SleepBlock from "./SleepBlock";
import { celebrate, markSeen } from "@/lib/celebrate";
import { BAD_WEEK_SCREEN, type Field, type Screen } from "@/lib/checkin-screens";
import VideoRecorder from "@/components/VideoRecorder";
import { submitCheckin } from "./actions";
import type { NewHabit } from "./CheckinForm";

const display = "font-[family-name:var(--font-display)] uppercase";
const HABIT_OPTIONS = [["done", "Done"], ["partly", "Partly"], ["not_yet", "Not yet"]] as const;
type Answers = Record<string, unknown>;

/** Change vs last week, said the way Michael would. Lower is better for stress and hunger. */
function nudge(id: string, now: number, last?: number | null) {
  if (!last || !now || now === last) return null;
  const up = now > last, good = id === "stress" || id === "hunger" ? !up : up;
  return { text: `${up ? "Up" : "Down"} ${Math.abs(now - last)} from last week.${good ? " Nice." : ""}`, good };
}

/**
 * The weekly check-in, VideoAsk style (November 10). Michael's welcome video and a Start button, then one question
 * per screen: his video on top (it plays with sound, because every Next is a tap), the answer fields underneath.
 */
export default function CheckinFlow({ week, userId, screens, videos, habits, closes, timeLeft, last, circles, badWeek, preview = false }: {
  week: number; userId: string; screens: Screen[]; videos: Record<string, string>; habits: NewHabit[];
  closes: string; timeLeft: string; last: Record<string, number | null> | null; circles: string[];
  badWeek: { already: boolean; left: number }; preview?: boolean;
}) {
  const [i, setI] = useState(0);
  const [a, setA] = useState<Answers>({});
  const [h, setH] = useState<Record<string, { status: string; note?: string }>>(Object.fromEntries(habits.map((x) => [x.id, { status: x.prefill }])));
  const [vids, setVids] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const set = (k: string, v: unknown) => { setError(""); setA((x) => ({ ...x, [k]: v })); };
  // Load the welcome video (CHK-01) right away; it plays when she taps ▶.
  useEffect(() => { const v = video.current; if (v && !v.src && videos["CHK-01"]) v.src = videos["CHK-01"]; }, [videos]);

  const bad = badWeek.already || a.bad_week === true;
  const flow: (Screen | "welcome" | "review")[] = ["welcome", ...(bad ? [BAD_WEEK_SCREEN] : []), ...screens.filter((s) => !s.habits || habits.length), "review"];
  const cur = flow[i];
  const screen = typeof cur === "object" ? cur : null;
  const codeOf = (s: (typeof flow)[number]) => (s === "welcome" ? "CHK-01" : s === "review" ? null : s.code);

  /** Load a screen's video and play it right away. Called from the tap itself, so iPhones allow the sound. */
  function play(code: string | null) {
    const v = video.current;
    if (!v) return;
    const url = code ? videos[code] : null;
    if (!url) { v.pause(); v.removeAttribute("src"); v.load(); setPlaying(false); return; }
    if (v.src !== url) v.src = url;
    v.currentTime = 0; v.muted = muted;
    v.play().then(() => setPlaying(true), () => setPlaying(false));
  }
  function go(n: number) { setError(""); setI(n); play(codeOf(flow[n])); window.scrollTo({ top: 0 }); }

  function missing(s: Screen): string | null {
    for (const f of s.fields) {
      if (f.optional || f.kind === "note" || f.kind === "multi") continue;
      const v = a[f.id];
      if (f.kind === "open" && (vids[f.id] || (typeof v === "string" && v.trim()))) continue;
      if (f.kind === "circles" && Array.isArray(v) && v.length === Math.min(3, circles.length)) continue;
      if ((f.kind === "scale" || f.kind === "choice") && v !== undefined && v !== "") continue;
      return f.kind === "scale" ? "Tap a number." : f.kind === "choice" ? "Pick one." : f.kind === "circles" ? `Pick ${Math.min(3, circles.length)}.` : "Answer this one, or record a quick video.";
    }
    return null;
  }
  function next() {
    if (screen) { const m = missing(screen); if (m) { setError(m); return; } }
    go(i + 1);
  }
  async function submit() {
    if (preview) { setSent(true); video.current?.pause(); return; } // Michael's preview: nothing is saved
    setBusy(true); setError("");
    const first = Object.values(vids)[0] ?? null;
    const r = await submitCheckin({ week, answers: { ...a, videos: vids, habits: habits.map((x) => ({ item_id: x.id, title: x.title, ...h[x.id] })) }, videoPath: first });
    setBusy(false);
    if (r?.error) setError(r.error); else { setSent(true); video.current?.pause(); celebrate("checkin-sent"); markSeen(10); }
  }

  if (sent) {
    return (
      <div className="space-y-2 rounded-[18px] border border-accent bg-[#1f1708] p-6 text-center">
        <p className={`${display} text-2xl font-semibold`}>Checked in</p>
        <p className="text-[#c9b48a]">{preview ? "Preview only. Nothing was saved." : <>+10 CPs. Michael will reply before Monday is over, and your next Habits &amp; Homework is open.</>}</p>
      </div>
    );
  }

  const code = codeOf(cur);
  const hasVideo = !!(code && videos[code]);
  const steps = flow.length - 2;
  return (
    <div className="space-y-3 pb-28">
      <div className="flex items-end justify-between">
        <h1 className={`${display} text-[26px] font-semibold`}>Week {week}</h1>
        <p className="pb-1 text-right text-xs text-[#a8a8a8]">Closes {closes}<br /><b className="text-gold">{timeLeft}</b></p>
      </div>
      {cur !== "welcome" && (
        <div className="flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#262626]"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(Math.min(i, steps) / steps) * 100}%` }} /></div>
          <span className="text-[11px] text-dim">{cur === "review" ? "Ready" : `${i} of ${steps}`}</span>
        </div>
      )}

      {/* Michael's video: one player for the whole check-in, so the sound keeps working from screen to screen. */}
      <div className={hasVideo ? "relative mx-auto w-fit" : "hidden"}>
        <video ref={video} playsInline preload="auto" onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)}
          onClick={(e) => { const v = e.currentTarget; if (v.paused) v.play(); else v.pause(); }}
          className="block h-[min(42dvh,520px)] w-auto max-w-full rounded-[22px] bg-black object-cover" />
        {!playing && (
          <button type="button" onClick={() => { const v = video.current; if (!v) return; if (v.ended) v.currentTime = 0; v.muted = muted; v.play(); }}
            aria-label="Play Michael's video" className="absolute inset-0 grid place-items-center rounded-[22px] bg-black/30">
            <span className="grid size-16 place-items-center rounded-full bg-accent text-2xl text-black">▶</span>
          </button>
        )}
        <div className="absolute bottom-2 right-2 flex gap-1.5">
          <button type="button" onClick={() => { const v = video.current; if (v) { v.currentTime = 0; v.play(); } }} className="grid size-10 place-items-center rounded-full bg-black/60 text-lg text-white" aria-label="Replay">↺</button>
          <button type="button" onClick={() => { const v = video.current; if (v) { v.muted = !muted; setMuted(!muted); } }} className="grid size-10 place-items-center rounded-full bg-black/60 text-sm text-white" aria-label={muted ? "Sound on" : "Sound off"}>{muted ? "🔇" : "🔊"}</button>
        </div>
      </div>

      {cur === "welcome" && (
        <div className="space-y-3">
          {!hasVideo && <p className="rounded-[18px] border border-border bg-card p-4 text-[15px]">Hey, it&apos;s check-in time. This takes about three minutes, and Michael reads every word and replies to you personally.</p>}
          {badWeek.already
            ? <p className="rounded-[14px] border border-[#7c5cff]/60 bg-[#151024] p-3 text-[14px]">This week is a <b>bad week</b> (Bad Week Plan). It still counts. Just tell me how it went.</p>
            : <label className="flex items-start gap-3 rounded-[14px] border border-[#7c5cff]/60 bg-[#151024] p-3">
                <input type="checkbox" checked={a.bad_week === true} disabled={!badWeek.left} onChange={(e) => set("bad_week", e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[#7c5cff]" />
                <span className="text-[14px] leading-snug"><b>This was a bad week</b><span className="block text-[12px] text-[#a8a8a8]">{badWeek.left
                  ? `No explanation needed. It still counts toward your 80%. ${badWeek.left} of 3 left.`
                  : "You've used all 3 bad weeks. Michael will reach out to you."}</span></span>
              </label>}
        </div>
      )}

      {screen && (
        <div className="space-y-3">
          <h2 className="text-[20px] font-semibold leading-tight">{screen.title}</h2>
          {screen.habits && <HabitsStep habits={habits} h={h} setH={setH} />}
          {screen.fields.map((f) => (
            <FieldInput key={f.id} f={f} value={a[f.id]} last={last?.[f.id]} circles={circles} onChange={(v) => set(f.id, v)}
              video={vids[f.id] ?? null} onVideo={(p) => setVids((x) => { const y = { ...x }; if (p) y[f.id] = p; else delete y[f.id]; return y; })}
              folder={`${userId}/week-${week}`} />
          ))}
          {screen.key === "sleep" && (
            <SleepBlock userId={userId} week={week} hours={a.sleep_hours as string | undefined} photos={(a.sleep_photos as string[] | undefined) ?? []}
              onHours={(v) => set("sleep_hours", v)} onPhotos={(v) => set("sleep_photos", v)} />
          )}
        </div>
      )}

      {cur === "review" && (
        <div className="space-y-3 rounded-[18px] border border-border bg-card p-4">
          <p className="text-base font-semibold">Ready to send</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {["sleep", "energy", "stress", "hunger"].map((k) => (
              <div key={k} className="rounded-xl bg-bg p-2"><p className="text-[11px] uppercase tracking-wider text-dim">{k}</p><p className={`${display} text-2xl`}>{String(a[k] ?? "–")}</p></div>
            ))}
          </div>
          {habits.length > 0 && <p className="text-sm text-[#a8a8a8]">Habits: {habits.filter((x) => h[x.id]?.status === "done").length} done, {habits.filter((x) => h[x.id]?.status === "partly").length} partly, {habits.filter((x) => h[x.id]?.status === "not_yet").length} not yet</p>}
          {Object.keys(vids).length > 0 && <p className="text-sm text-[#7ee2a8]">{Object.keys(vids).length} video answer{Object.keys(vids).length > 1 ? "s" : ""} attached.</p>}
          {typeof a.win === "string" && a.win && <p className="text-sm"><b className="text-gold">Your win:</b> {a.win}</p>}
          <p className="text-xs text-dim">Michael replies personally, usually before Monday is over.</p>
        </div>
      )}

      {error && <p className="text-sm text-[var(--red)]">{error}</p>}

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+57px)] z-10 border-t border-border bg-[#0f0f0f]/95 backdrop-blur">
        <div className="mx-auto flex max-w-md gap-2 px-4 py-3">
          {i > 0 && <button type="button" onClick={() => go(i - 1)} className="min-h-[52px] rounded-[14px] border border-border px-5">Back</button>}
          {cur === "welcome"
            ? <button type="button" onClick={() => go(1)} className="min-h-[52px] flex-1 rounded-[14px] bg-accent text-[17px] font-semibold text-black">Start check-in</button>
            : cur === "review"
              ? <button type="button" disabled={busy} onClick={submit} className="min-h-[52px] flex-1 rounded-[14px] bg-accent text-[17px] font-semibold text-black disabled:opacity-50">{busy ? "Sending…" : "Send my check-in · +10 CPs"}</button>
              : <button type="button" onClick={next} className="min-h-[52px] flex-1 rounded-[14px] bg-accent text-[17px] font-semibold text-black">Next</button>}
        </div>
      </div>
    </div>
  );
}

function HabitsStep({ habits, h, setH }: { habits: NewHabit[]; h: Record<string, { status: string; note?: string }>; setH: React.Dispatch<React.SetStateAction<Record<string, { status: string; note?: string }>>> }) {
  return (
    <>
      <p className="text-[14px] text-[#a8a8a8]">I filled these in from what you checked off. Change anything that&apos;s off.</p>
      {habits.map((x) => (
        <div key={x.id} className="space-y-2.5 rounded-[18px] border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-[0.12em]" style={{ color: x.color }}>{x.circle}</p>
          <p className="text-[15px]">{x.title}</p>
          <div className="grid grid-cols-3 gap-2">
            {HABIT_OPTIONS.map(([v, l]) => (
              <button key={v} type="button" onClick={() => setH((s) => ({ ...s, [x.id]: { ...s[x.id], status: v } }))} aria-pressed={h[x.id]?.status === v}
                className={`min-h-11 rounded-xl border text-sm ${h[x.id]?.status === v ? "border-accent bg-accent/10 font-semibold text-accent" : "border-[#2a2a2a] text-dim"}`}>{l}</button>
            ))}
          </div>
          {h[x.id]?.status !== "done" && (
            <input placeholder="What got in the way? (optional)" aria-label={`What got in the way of ${x.title}`} value={h[x.id]?.note ?? ""}
              onChange={(e) => setH((s) => ({ ...s, [x.id]: { ...s[x.id], note: e.target.value } }))}
              className="min-h-11 w-full rounded-xl border border-[#2a2a2a] bg-bg px-3 text-base outline-none focus:border-accent" />
          )}
        </div>
      ))}
    </>
  );
}

function FieldInput({ f, value, last, circles, onChange, video, onVideo, folder }: {
  f: Field; value: unknown; last?: number | null; circles: string[]; onChange: (v: unknown) => void;
  video: string | null; onVideo: (path: string | null) => void; folder: string;
}) {
  const [recording, setRecording] = useState(false);
  const box = "space-y-2.5 rounded-[18px] border border-border bg-card p-4";
  if (f.kind === "scale") {
    const n = nudge(f.id, Number(value), last);
    return (
      <div role="group" aria-label={f.label} className={box}>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[14px] text-[#cfcfcf]">{f.help}</p>
          {last ? <span className="shrink-0 text-xs text-dim">Last week {last}</span> : null}
        </div>
        <div className="grid grid-cols-10 gap-1">
          {Array.from({ length: 10 }, (_, k) => k + 1).map((v) => (
            <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={value === v} aria-label={`${f.label} ${v}`}
              className={`min-h-11 rounded-[10px] text-sm ${value === v ? "bg-accent font-bold text-black" : "border border-[#2a2a2a] text-[#a8a8a8]"}`}>{v}</button>
          ))}
        </div>
        {n && <p className={`text-xs ${n.good ? "text-[#7ee2a8]" : "text-dim"}`}>{n.text}</p>}
      </div>
    );
  }
  if (f.kind === "choice") return (
    <div role="group" aria-label={f.label} className={box}>
      <p className="text-[15px] font-semibold">{f.label}</p>
      <div className="flex flex-wrap gap-2">
        {f.options!.map((o) => (
          <button key={o} type="button" onClick={() => onChange(o)} aria-pressed={value === o}
            className={`min-h-11 rounded-xl px-3.5 text-sm ${value === o ? "bg-accent font-semibold text-black" : "border border-[#2a2a2a]"}`}>{o}</button>
        ))}
      </div>
    </div>
  );
  if (f.kind === "multi" || f.kind === "circles") {
    const picked = Array.isArray(value) ? (value as string[]) : [];
    const options = f.kind === "circles" ? circles : f.options!;
    const max = f.kind === "circles" ? 3 : Infinity;
    return (
      <div role="group" aria-label={f.label} className={box}>
        <p className="text-[15px] font-semibold">{f.label}{f.kind === "circles" ? ` (${picked.length}/3)` : ""}</p>
        <div className="flex flex-wrap gap-2">
          {options.map((o) => {
            const on = picked.includes(o);
            return (
              <button key={o} type="button" aria-pressed={on} disabled={!on && picked.length >= max}
                onClick={() => onChange(on ? picked.filter((x) => x !== o) : [...picked, o])}
                className={`min-h-11 rounded-xl px-3 py-2 text-left text-[13px] leading-snug disabled:opacity-40 ${on ? "bg-accent font-semibold text-black" : "border border-[#2a2a2a]"}`}>{on ? "✓ " : ""}{o}</button>
            );
          })}
        </div>
      </div>
    );
  }
  if (f.kind === "note") return (
    <label className="block space-y-1.5">
      <span className="text-[13px] text-dim">{f.label}</span>
      <textarea rows={2} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-[#2a2a2a] bg-bg p-3 text-base outline-none focus:border-accent" />
    </label>
  );
  // Open answer: type it, talk to the keyboard mic, or record a video.
  return (
    <div className={box}>
      <p className="text-[14px] text-[#cfcfcf]">{f.label}{f.optional ? <span className="text-dim"> (optional)</span> : null}</p>
      {!video && (
        <textarea rows={4} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} placeholder="Type here, or tap the 🎤 on your keyboard and just talk"
          className="w-full rounded-xl border border-[#2a2a2a] bg-bg p-3 text-base outline-none focus:border-accent" />
      )}
      {video
        ? <p className="flex items-center justify-between text-sm text-[#7ee2a8]">✓ Your video answer is attached <button type="button" onClick={() => onVideo(null)} className="text-xs text-dim underline">Remove</button></p>
        : recording
          ? <VideoRecorder folder={folder} label="Record your answer" onUploaded={(p) => { onVideo(p); if (p) setRecording(false); }} />
          : <button type="button" onClick={() => setRecording(true)} className="min-h-10 text-[13px] font-semibold text-accent">🎥 Record a video answer instead</button>}
    </div>
  );
}
