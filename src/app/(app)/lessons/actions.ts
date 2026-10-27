"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadLessons, type QuizQ } from "@/lib/lessons";

const QUIZ_CPS = 5;

async function openLesson(lessonId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { all } = await loadLessons(supabase, user.id);
  const l = all.find((x) => x.id === lessonId);
  if (!l?.open) throw new Error("This lesson isn't open yet");
  return { supabase, user, l };
}

export async function markWatched(lessonId: string) {
  const { supabase, user } = await openLesson(lessonId);
  await supabase.from("lesson_progress").upsert({ client_id: user.id, lesson_id: lessonId, watched_at: new Date().toISOString() }, { onConflict: "client_id,lesson_id" });
  revalidatePath("/lessons"); revalidatePath("/today");
}

/** One answer, checked the moment she taps it (the right answers never go to her phone). */
export async function checkAnswer(lessonId: string, question: number, choice: number) {
  const { l } = await openLesson(lessonId);
  const q = ((l.quiz ?? []) as QuizQ[])[question];
  if (l.quiz_status !== "approved" || !q) return { correct: false };
  return { correct: q.correct === choice };
}

/** Check her answers on the server; all correct passes the quiz (+5 CPs, once). Returns which ones were wrong. */
export async function submitQuiz(lessonId: string, answers: number[]) {
  const { supabase, user, l } = await openLesson(lessonId);
  const quiz = (l.quiz ?? []) as QuizQ[];
  if (l.quiz_status !== "approved" || !quiz.length) return { passed: false, wrong: [] as number[] };
  const wrong = quiz.map((q, i) => (answers[i] === q.correct ? -1 : i)).filter((i) => i >= 0);
  if (wrong.length) return { passed: false, wrong };
  const now = new Date().toISOString();
  await supabase.from("lesson_progress").upsert({ client_id: user.id, lesson_id: lessonId, watched_at: now, quiz_passed_at: now }, { onConflict: "client_id,lesson_id" });
  if (!l.quizPassed) {
    const { data: had } = await supabase.from("cp_ledger").select("id").eq("client_id", user.id).eq("reason", "lesson").eq("source_id", lessonId).maybeSingle();
    if (!had) await supabase.from("cp_ledger").insert({ client_id: user.id, points: QUIZ_CPS, reason: "lesson", source_id: lessonId });
  }
  revalidatePath("/lessons"); revalidatePath("/today");
  return { passed: true, wrong: [] };
}
