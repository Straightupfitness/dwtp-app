"use client";
import { useState, useTransition } from "react";
import { checkAnswer, markWatched, submitQuiz } from "../actions";
import { celebrate, markSeen, play } from "@/lib/celebrate";

/**
 * "Done" for the lesson, then its quiz (if Michael approved one). Each answer is checked the moment she taps it:
 * ka-ching when it's right, the wrong-answer sound when it isn't (she tries again). The last right answer passes
 * the quiz: the quiz-passed sound, confetti, +5 CPs.
 */
export default function LessonActions({ lessonId, kind, watched, quizPassed, quiz, coach }: {
  lessonId: string; kind: string; watched: boolean; quizPassed: boolean; quiz: { q: string; options: string[] }[]; coach: boolean;
}) {
  const [done, setDone] = useState(watched);
  const [passed, setPassed] = useState(quizPassed);
  const [answers, setAnswers] = useState<number[]>(quiz.map(() => -1));
  const [right, setRight] = useState<boolean[]>(quiz.map(() => false));
  const [wrongPick, setWrongPick] = useState<Record<number, number>>({});
  const [checking, setChecking] = useState<number | null>(null);

  async function pick(i: number, j: number) {
    if (right[i] || checking !== null) return;
    setChecking(i);
    setAnswers((a) => a.map((x, k) => (k === i ? j : x)));
    const { correct } = await checkAnswer(lessonId, i, j).catch(() => ({ correct: false }));
    setChecking(null);
    if (!correct) { play("wrong-answer"); setWrongPick((w) => ({ ...w, [i]: j })); return; }
    const nextRight = right.map((x, k) => x || k === i);
    setRight(nextRight);
    setWrongPick((w) => { const n = { ...w }; delete n[i]; return n; });
    if (nextRight.every(Boolean)) {
      const r = await submitQuiz(lessonId, answers.map((x, k) => (k === i ? j : x)));
      if (r.passed) { celebrate("quiz-passed"); markSeen(5); setTimeout(() => setPassed(true), 900); }
      else setError("Something went wrong saving your quiz. Try again.");
    } else play("ka-ching");
  }
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
        <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Quick quiz · +5 CPs</p>
          {quiz.map((q, i) => (
            <fieldset key={i} className="space-y-1.5" disabled={right[i]}>
              <legend className="mb-1 text-[15px] font-semibold">{q.q}</legend>
              {q.options.map((o, j) => {
                const isRight = right[i] && answers[i] === j, isWrong = wrongPick[i] === j;
                return (
                  <button key={j} type="button" onClick={() => pick(i, j)} aria-pressed={answers[i] === j}
                    className={`flex min-h-11 w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left text-[14px] transition ${
                      isRight ? "border-[#2f6b47] bg-[#0f1a14] text-[#c9f2d8]" : isWrong ? "animate-[shake_300ms] border-[var(--red)] bg-[#1c0c0b]" : right[i] ? "border-[#222] text-dim" : "border-[#2a2a2a]"}`}>
                    <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[11px] ${isRight ? "border-[#7ee2a8] bg-[#7ee2a8] text-black" : isWrong ? "border-[var(--red)] text-[var(--red)]" : "border-[#444]"}`} aria-hidden="true">
                      {isRight ? "✓" : isWrong ? "✕" : checking === i && answers[i] === j ? "…" : ""}
                    </span>
                    {o}
                  </button>
                );
              })}
              {wrongPick[i] !== undefined && !right[i] && <p className="text-xs text-[#ff8a7e]">Not quite. Try another one.</p>}
              {right[i] && <p className="text-xs text-[#7ee2a8]">That&apos;s it!</p>}
            </fieldset>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-[var(--red)]">{error}</p>}
    </div>
  );
}
