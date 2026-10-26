"use client";
import { useState } from "react";
import type { Lesson, QuizQ } from "@/lib/lessons";
import { saveLesson } from "../actions";

const input = "min-h-11 w-full rounded-lg border border-[#2a2a2a] bg-bg px-3 text-[15px] outline-none focus:border-accent";

export default function LessonEditor({ lesson }: { lesson: Lesson }) {
  const [title, setTitle] = useState(lesson.title);
  const [video, setVideo] = useState(lesson.video_url ?? "");
  const [body, setBody] = useState(lesson.body ?? "");
  const [quiz, setQuiz] = useState<QuizQ[]>(lesson.quiz ?? []);
  const [status, setStatus] = useState(lesson.quiz_status as "none" | "draft" | "approved");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  const setQ = (i: number, patch: Partial<QuizQ>) => setQuiz((qs) => qs.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  async function save(next: "none" | "draft" | "approved" = status) {
    setBusy("save"); setMsg("");
    const r = await saveLesson(lesson.id, { title, video_url: video, body, quiz, quiz_status: next });
    setBusy("");
    if (r.error) setMsg(r.error); else { setStatus(quiz.length ? next : "none"); setMsg(next === "approved" ? "Saved. The quiz is live." : "Saved."); }
  }
  async function draft() {
    setBusy("ai"); setMsg("");
    const res = await fetch("/api/coach/quiz", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lessonId: lesson.id }) });
    const data = await res.json().catch(() => ({ error: "The AI quiz failed." }));
    setBusy("");
    if (!res.ok) { setMsg(data.error); return; }
    setQuiz(data.quiz); setStatus("draft"); setMsg("Draft ready. Check it, edit anything, then approve.");
  }

  return (
    <div className="space-y-4 pb-6">
      <label className="block space-y-1"><span className="text-[13px] text-[#a8a8a8]">Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={input} /></label>
      <label className="block space-y-1"><span className="text-[13px] text-[#a8a8a8]">Video link (YouTube or Wistia)</span>
        <input value={video} onChange={(e) => setVideo(e.target.value)} placeholder="https://youtu.be/…" className={input} /></label>
      <label className="block space-y-1"><span className="text-[13px] text-[#a8a8a8]">{lesson.kind === "hh" ? "Your intro (optional; the week's new habits show below it automatically)" : "Text"}</span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={lesson.kind === "hh" ? 5 : 14}
          className="w-full rounded-lg border border-[#2a2a2a] bg-bg p-3 text-[15px] leading-relaxed outline-none focus:border-accent" /></label>

      <div className="space-y-3 rounded-2xl border border-border bg-card p-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Quiz · {status === "approved" ? "live" : status === "draft" ? "draft, not live" : "none"}</p>
          <button type="button" onClick={draft} disabled={!!busy} className="min-h-10 rounded-lg border border-accent px-3 text-[13px] font-semibold text-accent disabled:opacity-50">
            {busy === "ai" ? "Writing… (about 15 sec)" : quiz.length ? "Redraft with AI" : "Draft with AI"}
          </button>
        </div>
        {quiz.map((q, i) => (
          <div key={i} className="space-y-2 border-t border-border pt-3">
            <div className="flex gap-2">
              <input value={q.q} onChange={(e) => setQ(i, { q: e.target.value })} aria-label={`Question ${i + 1}`} className={input} />
              <button type="button" onClick={() => setQuiz((qs) => qs.filter((_, k) => k !== i))} className="min-h-11 px-2 text-xs text-[var(--red)]">Remove</button>
            </div>
            {q.options.map((o, j) => (
              <label key={j} className="flex items-center gap-2">
                <input type="radio" name={`correct${i}`} checked={q.correct === j} onChange={() => setQ(i, { correct: j })} className="accent-[var(--accent)]" aria-label="Right answer" />
                <input value={o} onChange={(e) => setQ(i, { options: q.options.map((x, k) => (k === j ? e.target.value : x)) })} className={input} />
              </label>
            ))}
            <p className="text-xs text-dim">The dot marks the right answer.</p>
          </div>
        ))}
        <button type="button" onClick={() => setQuiz((qs) => [...qs, { q: "", options: ["", "", ""], correct: 0 }])} className="min-h-10 text-[13px] text-accent">+ Add a question</button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => save(status === "approved" ? "approved" : "draft")} disabled={!!busy} className="min-h-12 rounded-xl border border-accent text-[15px] font-semibold text-accent disabled:opacity-50">{busy === "save" ? "Saving…" : "Save"}</button>
        {status === "approved"
          ? <button type="button" onClick={() => save("draft")} disabled={!!busy} className="min-h-12 rounded-xl border border-border text-[15px] font-semibold disabled:opacity-50">Take quiz offline</button>
          : <button type="button" onClick={() => save("approved")} disabled={!!busy || !quiz.length} className="min-h-12 rounded-xl bg-accent text-[15px] font-semibold text-black disabled:opacity-50">Approve quiz</button>}
      </div>
      {msg && <p className="text-sm text-[#a8a8a8]">{msg}</p>}
    </div>
  );
}
