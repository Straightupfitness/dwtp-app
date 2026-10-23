"use client";
import { useState } from "react";
import type { Question } from "@/lib/checkin";
import VideoRecorder from "@/components/VideoRecorder";
import { submitCheckin } from "./actions";

export type NewHabit = { id: string; title: string; circle: string; color: string; prefill: "done" | "partly" | "not_yet" };
function Scale({ q, value, onPick }: { q: Question; value: unknown; onPick: (n: number) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="font-medium">{q.label}</legend>
      {q.help && <p className="text-xs text-dim">{q.help}</p>}
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" onClick={() => onPick(n)} aria-pressed={value === n}
            className={`min-h-11 rounded-lg border text-sm ${value === n ? "border-accent bg-accent font-semibold text-black" : "border-border"}`}>{n}</button>
        ))}
      </div>
    </fieldset>
  );
}

const HABIT_OPTIONS = [["done", "Done"], ["partly", "Partly"], ["not_yet", "Not yet"]] as const;

export default function CheckinForm({ week, userId, questions, isVideo, habits, closes }: {
  week: number; userId: string; questions: Question[]; isVideo: boolean; habits: NewHabit[]; closes: string;
}) {
  const [a, setA] = useState<Record<string, unknown>>({});
  const [h, setH] = useState<Record<string, { status: string; note?: string }>>(
    Object.fromEntries(habits.map((x) => [x.id, { status: x.prefill }])));
  const [video, setVideo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const set = (k: string, v: unknown) => setA((x) => ({ ...x, [k]: v }));

  const videoQs = isVideo ? questions.filter((q) => q.video) : [];
  const shownQs = questions.filter((q) => !(isVideo && q.video));
  const missing = shownQs.filter((q) => !q.optional && (a[q.id] === undefined || a[q.id] === ""))
    .concat(isVideo && !video && videoQs.some((q) => !q.optional && !a[q.id]) ? [{ id: "video" } as Question] : []);

  async function submit() {
    if (missing.length) { setError("Answer every question first (the last one is optional)."); return; }
    setBusy(true); setError("");
    const habitAnswers = habits.map((x) => ({ item_id: x.id, title: x.title, ...h[x.id] }));
    const r = await submitCheckin({ week, answers: { ...a, habits: habitAnswers }, videoPath: video });
    setBusy(false);
    if (r?.error) setError(r.error); else setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-2 rounded-2xl border border-accent bg-card p-5 text-center">
        <p className="font-[family-name:var(--font-display)] text-2xl uppercase">Checked in</p>
        <p className="text-dim">+10 CPs. Michael will reply before Monday is over.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {shownQs.filter((q) => q.kind === "scale").map((q) => <Scale key={q.id} q={q} value={a[q.id]} onPick={(n) => set(q.id, n)} />)}

      {habits.length > 0 && (
        <fieldset className="space-y-3">
          <legend className="font-medium">This week&apos;s new habits</legend>
          {habits.map((x) => (
            <div key={x.id} className="space-y-2 rounded-xl border border-border bg-card p-3">
              <p className="text-xs uppercase tracking-wider" style={{ color: x.color }}>{x.circle}</p>
              <p className="text-[15px]">{x.title}</p>
              <div className="flex gap-2">
                {HABIT_OPTIONS.map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setH((s) => ({ ...s, [x.id]: { ...s[x.id], status: v } }))}
                    aria-pressed={h[x.id]?.status === v}
                    className={`min-h-11 flex-1 rounded-lg border text-sm ${h[x.id]?.status === v ? "border-accent text-accent" : "border-border text-dim"}`}>{l}</button>
                ))}
              </div>
              {h[x.id]?.status !== "done" && (
                <input placeholder="What got in the way? (optional)" value={h[x.id]?.note ?? ""}
                  onChange={(e) => setH((s) => ({ ...s, [x.id]: { ...s[x.id], note: e.target.value } }))}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-base outline-none focus:border-accent" />
              )}
            </div>
          ))}
        </fieldset>
      )}

      {shownQs.filter((q) => q.kind === "choice").map((q) => (
        <fieldset key={q.id} className="space-y-2">
          <legend className="font-medium">{q.label}</legend>
          <div className="flex flex-wrap gap-2">
            {q.options!.map((o) => (
              <button key={o} type="button" onClick={() => set(q.id, o)} aria-pressed={a[q.id] === o}
                className={`min-h-11 rounded-lg border px-3 text-sm ${a[q.id] === o ? "border-accent bg-accent font-semibold text-black" : "border-border"}`}>{o}</button>
            ))}
          </div>
        </fieldset>
      ))}

      {isVideo && (
        <div className="space-y-2">
          <p className="font-medium">This week is a video check-in</p>
          <p className="text-sm text-dim">Record one video (up to 5 minutes) and talk Michael through:</p>
          <ul className="list-disc pl-5 text-sm">{videoQs.map((q) => <li key={q.id}>{q.label}{q.optional ? " (optional)" : ""}</li>)}</ul>
          <VideoRecorder folder={`${userId}/week-${week}`} onUploaded={setVideo} />
          {!video && (
            <details className="text-sm">
              <summary className="cursor-pointer text-dim">Can&apos;t record right now? Type your answers instead</summary>
              <div className="mt-3 space-y-4">
                {videoQs.map((q) => (
                  <label key={q.id} className="block space-y-1">
                    <span>{q.label}</span>
                    <textarea rows={3} value={String(a[q.id] ?? "")} onChange={(e) => set(q.id, e.target.value)}
                      className="w-full rounded-lg border border-border bg-bg p-3 text-base outline-none focus:border-accent" />
                  </label>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {shownQs.filter((q) => q.kind === "text").map((q) => (
        <label key={q.id} className="block space-y-2">
          <span className="font-medium">{q.label}{q.optional ? <span className="text-dim"> (optional)</span> : null}</span>
          <textarea rows={3} value={String(a[q.id] ?? "")} onChange={(e) => set(q.id, e.target.value)}
            className="w-full rounded-lg border border-border bg-bg p-3 text-base outline-none focus:border-accent" />
        </label>
      ))}

      {error && <p className="text-sm text-[var(--red)]">{error}</p>}
      <button type="button" disabled={busy} onClick={submit} className="min-h-12 w-full rounded-xl bg-accent text-lg font-semibold text-black disabled:opacity-50">
        {busy ? "Sending…" : "Send my check-in"}
      </button>
      <p className="text-center text-xs text-dim">Closes {closes}. +10 CPs when you check in.</p>
    </div>
  );
}
