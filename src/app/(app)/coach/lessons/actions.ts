"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { QuizQ } from "@/lib/lessons";

async function coach() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").single();
  if (me?.role !== "coach") throw new Error("Coach only");
  return supabase;
}
const done = (id: string) => { revalidatePath("/lessons"); revalidatePath(`/lessons/${id}`); revalidatePath("/coach/lessons"); revalidatePath(`/coach/lessons/${id}`); };

export async function saveLesson(id: string, v: { title: string; video_url: string; body: string; quiz: QuizQ[]; quiz_status: "none" | "draft" | "approved" }) {
  const supabase = await coach();
  const quiz = v.quiz.map((q) => ({ q: q.q.trim(), options: q.options.map((o) => o.trim()).filter(Boolean), correct: q.correct }))
    .filter((q) => q.q && q.options.length >= 2);
  if (!v.title.trim()) return { error: "Give it a title." };
  if (v.quiz_status === "approved" && quiz.some((q) => q.correct < 0 || q.correct >= q.options.length)) return { error: "Pick the right answer for every question." };
  const { error } = await supabase.from("lessons").update({
    title: v.title.trim(), video_url: v.video_url.trim() || null, body: v.body.trim() || null,
    quiz: quiz.length ? quiz : null, quiz_status: quiz.length ? v.quiz_status : "none",
  }).eq("id", id);
  if (error) return { error: error.message };
  done(id);
  return { ok: true };
}
