"use client";
import { useState } from "react";
import type { Question } from "@/lib/checkin";
import VideoRecorder from "@/components/VideoRecorder";
import { submitCheckin } from "./actions";

export type NewHabit = { id: string; title: string; circle: string; color: string; prefill: "done" | "partly" | "not_yet" };
const HABIT_OPTIONS = [["done", "Done"], ["partly", "Partly"], ["not_yet", "Not yet"]] as const;
const STEPS = ["How you felt", "Habits", "Your week", "Send"];
const SCALE_NAMES: Record<string, string> = { sleep: "Sleep", energy: "Energy", stress: "Stress", hunger: "Hunger", confidence: "Confidence" };

/** Change vs last week, said the way Michael would. Lower is better for stress and hunger. */
function nudge(id: string, now: number, last?: number | null) {
  if (!last || !now || now === last) return null;
  const up = now > last, good = id === "stress" || id === "hunger" ? !up : up;
  return { text: `${up ? "Up" : "Down"} ${Math.abs(now - last)} from last week.${good ? " Nice." : ""}`, good };
}

function Scale({ q, value, last, onPick }: { q: Question; value: unknown; last?: number | null; onPick: (n: number) => void }) {
  const n = nudge(q.id, Number(value), last);
  return (
    <fieldset className="space-y-2.5 rounded-[18px] border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <legend className="text-base font-semibold">{q.label}</legend>
        <span className="shrink-0 text-xs text-dim">{last ? `Last week ${last}` : q.help ?? ""}</span>
      </div>
      {last && q.help && <p className="-mt-1 text-xs text-dim">{q.help}</p>}
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
          <button key={v} type="button" onClick={() => onPick(v)} aria-pressed={value === v} aria-label={`${SCALE_NAMES[q.id] ?? q.label} ${v}`}
            className={`min-h-11 rounded-[10px] text-sm ${value === v ? "bg-accent font-bold text-black" : "border border-[#2a2a2a] text-[#a8a8a8]"}`}>{v}</button>
        ))}
      </div>
      {n && <p className={`text-xs ${n.good ? "text-[#7ee2a8]" : "text-dim"}`}>{n.text}</p>}
    </fieldset>
  );
}

export default function CheckinForm({ week, userId, questions, isVideo, habits, closes, timeLeft, last }: {
  week: number; userId: string; questions: Question[]; isVideo: boolean; habits: NewHabit[]; closes: string; timeLeft: string;
  last: Record<string, number | null> | null;
}) {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Record<string, unknown>>({});
  const [h, setH] = useState<Record<string, { status: string; note?: string }>>(Object.fromEntries(habits.map((x) => [x.id, { status: x.prefill }])));
  const [video, setVideo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const set = (k: string, v: unknown) => setA((x) => ({ ...x, [k]: v }));

  const scales = questions.filter((q) => q.kind === "scale" && ["sleep", "energy", "stress", "hunger"].includes(q.id));
  const weekQs = questions.filter((q) => !scales.includes(q));
  const videoQs = isVideo ? weekQs.filter((q) => q.video) : [];
  const shownWeekQs = weekQs.filter((q) => !(isVideo && q.video));
  const missingIn = (qs: Question[]) => qs.filter((q) => !q.optional && (a[q.id] === undefined || a[q.id] === ""));
  const videoMissing = isVideo && !video && videoQs.some((q) => !q.optional && !a[q.id]);
  const steps = habits.length ? STEPS : STEPS.filter((s) => s !== "Habits");
  const name = steps[step];

  function next() {
    setError("");
    if (name === "How you felt" && missingIn(scales).length) { setError("Tap a number for each one."); return; }
    if (name === "Your week" && (missingIn(shownWeekQs).length || videoMissing)) { setError(videoMissing ? "Record your video, or type your answers instead." : "Answer each question (the last one is optional)."); return; }
    setStep((s) => s + 1); window.scrollTo({ top: 0 });
  }
  async function submit() {
    setBusy(true); setError("");
    const r = await submitCheckin({ week, answers: { ...a, habits: habits.map((x) => ({ item_id: x.id, title: x.title, ...h[x.id] })) }, videoPath: video });
    setBusy(false);
    if (r?.error) setError(r.error); else setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-2 rounded-[18px] border border-accent bg-[#1f1708] p-6 text-center">
        <p className="font-[family-name:var(--font-display)] text-2xl font-semibold uppercase">Checked in</p>
        <p className="text-[#c9b48a]">+10 CPs. Michael will reply before Monday is over.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 pb-24">
      <div className="flex items-end justify-between">
        <h1 className="font-[family-name:var(--font-display)] text-[30px] font-semibold uppercase">Week {week}</h1>
        <p className="pb-1 text-right text-xs text-[#a8a8a8]">Closes {closes}<br /><b className="text-gold">{timeLeft}</b></p>
      </div>
      <div className="space-y-2">
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
          {steps.map((s, i) => <div key={s} className={`h-1 rounded-full ${i <= step ? "bg-accent" : "bg-[#262626]"}`} />)}
        </div>
        <div className="grid gap-1.5 text-[11px] text-dim" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
          {steps.map((s, i) => <span key={s} className={i === step ? "font-semibold text-accent" : ""}>{i + 1} {s}</span>)}
        </div>
      </div>

      {name === "How you felt" && scales.map((q) => <Scale key={q.id} q={q} value={a[q.id]} last={last?.[q.id]} onPick={(v) => set(q.id, v)} />)}

      {name === "Habits" && (
        <>
          <p className="text-[15px] text-[#a8a8a8]">Your new habits this week. I filled these in from what you checked off; change anything that&apos;s off.</p>
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
      )}

      {name === "Your week" && (
        <>
          {shownWeekQs.filter((q) => q.kind === "scale").map((q) => <Scale key={q.id} q={q} value={a[q.id]} onPick={(v) => set(q.id, v)} />)}
          {shownWeekQs.filter((q) => q.kind === "choice").map((q) => (
            <fieldset key={q.id} className="space-y-2.5 rounded-[18px] border border-border bg-card p-4">
              <legend className="text-base font-semibold">{q.label}</legend>
              <div className="flex flex-wrap gap-2">
                {q.options!.map((o) => (
                  <button key={o} type="button" onClick={() => set(q.id, o)} aria-pressed={a[q.id] === o}
                    className={`min-h-11 rounded-xl px-3.5 text-sm ${a[q.id] === o ? "bg-accent font-semibold text-black" : "border border-[#2a2a2a]"}`}>{o}</button>
                ))}
              </div>
            </fieldset>
          ))}
          {isVideo && (
            <div className="space-y-2.5 rounded-[18px] border border-border bg-card p-4">
              <p className="text-base font-semibold">This week is a video check-in</p>
              <p className="text-sm text-[#a8a8a8]">Record one video (up to 5 minutes) and talk me through:</p>
              <ul className="list-disc space-y-0.5 pl-5 text-sm">{videoQs.map((q) => <li key={q.id}>{q.label}{q.optional ? " (optional)" : ""}</li>)}</ul>
              <VideoRecorder folder={`${userId}/week-${week}`} onUploaded={setVideo} />
              {!video && (
                <details className="text-sm">
                  <summary className="min-h-10 cursor-pointer pt-2 text-dim">Can&apos;t record right now? Type your answers instead</summary>
                  <div className="mt-3 space-y-4">
                    {videoQs.map((q) => (
                      <label key={q.id} className="block space-y-1.5"><span>{q.label}</span>
                        <textarea rows={3} value={String(a[q.id] ?? "")} onChange={(e) => set(q.id, e.target.value)}
                          className="w-full rounded-xl border border-[#2a2a2a] bg-bg p-3 text-base outline-none focus:border-accent" />
                      </label>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
          {shownWeekQs.filter((q) => q.kind === "text").map((q) => (
            <label key={q.id} className="block space-y-2 rounded-[18px] border border-border bg-card p-4">
              <span className="text-base font-semibold">{q.label}{q.optional ? <span className="font-normal text-dim"> (optional)</span> : null}</span>
              <textarea rows={3} value={String(a[q.id] ?? "")} onChange={(e) => set(q.id, e.target.value)}
                className="w-full rounded-xl border border-[#2a2a2a] bg-bg p-3 text-base outline-none focus:border-accent" />
            </label>
          ))}
        </>
      )}

      {name === "Send" && (
        <div className="space-y-3 rounded-[18px] border border-border bg-card p-4">
          <p className="text-base font-semibold">Ready to send</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {scales.map((q) => (
              <div key={q.id} className="rounded-xl bg-bg p-2">
                <p className="text-[11px] uppercase tracking-wider text-dim">{SCALE_NAMES[q.id]}</p>
                <p className="font-[family-name:var(--font-display)] text-2xl">{String(a[q.id] ?? "–")}</p>
              </div>
            ))}
          </div>
          {habits.length > 0 && <p className="text-sm text-[#a8a8a8]">Habits: {habits.filter((x) => h[x.id]?.status === "done").length} done, {habits.filter((x) => h[x.id]?.status === "partly").length} partly, {habits.filter((x) => h[x.id]?.status === "not_yet").length} not yet</p>}
          {video && <p className="text-sm text-[#7ee2a8]">Your video is attached.</p>}
          {typeof a.win === "string" && a.win && <p className="text-sm"><b className="text-gold">Your win:</b> {a.win}</p>}
          <p className="text-xs text-dim">Michael replies personally, usually before Monday is over.</p>
        </div>
      )}

      {error && <p className="text-sm text-[var(--red)]">{error}</p>}

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+57px)] z-10 border-t border-border bg-[#0f0f0f]/95 backdrop-blur">
        <div className="mx-auto flex max-w-md gap-2 px-4 py-3">
          {step > 0 && <button type="button" onClick={() => { setStep(step - 1); setError(""); }} className="min-h-[52px] rounded-[14px] border border-border px-5">Back</button>}
          {name !== "Send"
            ? <button type="button" onClick={next} className="min-h-[52px] flex-1 rounded-[14px] bg-accent text-[17px] font-semibold text-black">Next: {steps[step + 1].toLowerCase()}</button>
            : <button type="button" disabled={busy} onClick={submit} className="min-h-[52px] flex-1 rounded-[14px] bg-accent text-[17px] font-semibold text-black disabled:opacity-50">{busy ? "Sending…" : "Send my check-in · +10 CPs"}</button>}
        </div>
      </div>
    </div>
  );
}
