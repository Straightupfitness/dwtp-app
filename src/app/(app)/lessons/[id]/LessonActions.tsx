"use client";
import { useState, useTransition } from "react";
import { markWatched, submitQuiz } from "../actions";

/** "Done" for the lesson, then its quiz (if Michael approved one): all answers right = +5 CPs. */
export default function LessonActions({ lessonId, kind, watched, quizPassed, quiz, coach }: {
  lessonId: string; kind: string; watched: boolean; quizPassed: boolean; quiz: { q: string; options: string[] }[]; coach: boolean;
}) {
  const [done, setDone] = useState(watched);
  const [passed, setPassed] = useState(quizPassed);
  const [answers, setAnswers] = useState<number[]>(quiz.map(() => -1));
  const [wrong, setWrong] = useState<number[]>([]);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const verb = kind === "hh" ? "I've read this week's Habits & Homework" : kind === "sbw" ? "I watched it" : "I read it";

  if (coach) return <p className="rounded-xl border border-border bg-card p-3 text-xs text-dim">Coach preview. Clients see a Done button{quiz.length ? " and the quiz" : ""} here.</p>;

  return (
    <div className="space-y-3 pb-4">
      {!done ? (
        <button type="button" disabled={pending} onClick={() => start(async () => {
          try { await markWatched(lessonId); setDone(true); } catch (e) { setError((e as Error).message); }
        })} className="min-h-[52px] w-full rounded-[14px] bg-accent text-[16px] font-semibold text-black disabled:opacity-60">{pending ? "Saving…" : verb}</button>
      ) : !quiz.length || passed ? (
        <p className="rounded-xl border border-[#1f3a2a] bg-[#0f1a14] p-3 text-center text-sm text-[#7ee2a8]">Done{passed ? " · quiz passed, +5 CPs" : ""} ✓</p>
      ) : null}

      {done && quiz.length > 0 && !passed && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Quick quiz · +5 CPs</p>
          {quiz.map((q, i) => (
            <fieldset key={i} className="space-y-1.5">
              <legend className="mb-1 text-[15px] font-semibold">{q.q}</legend>
              {q.options.map((o, j) => (
                <label key={j} className={`flex min-h-11 cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[14px] ${answers[i] === j ? (wrong.includes(i) ? "border-[var(--red)]" : "border-accent") : "border-[#2a2a2a]"}`}>
                  <input type="radio" name={`q${i}`} checked={answers[i] === j} className="mt-1 accent-[var(--accent)]"
                    onChange={() => { setAnswers((a) => a.map((x, k) => (k === i ? j : x))); setWrong((w) => w.filter((k) => k !== i)); }} />
                  {o}
                </label>
              ))}
              {wrong.includes(i) && <p className="text-xs text-[#ff8a7e]">Not quite. Have another look and try again.</p>}
            </fieldset>
          ))}
          <button type="button" disabled={pending || answers.includes(-1)} onClick={() => start(async () => {
            const r = await submitQuiz(lessonId, answers);
            if (r.passed) setPassed(true); else setWrong(r.wrong);
          })} className="min-h-12 w-full rounded-xl bg-accent text-[15px] font-semibold text-black disabled:opacity-50">{pending ? "Checking…" : "Check my answers"}</button>
        </div>
      )}
      {error && <p className="text-sm text-[var(--red)]">{error}</p>}
    </div>
  );
}
