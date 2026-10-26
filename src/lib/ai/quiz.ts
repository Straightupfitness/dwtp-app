import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { askClaude } from "./anthropic";
import { PROGRAM_RULES } from "./voice";
import { KIND_LABEL, weekMedals, type QuizQ } from "../lessons";

const SYSTEM = `You write a short quiz for one lesson in Michael Duivis's Driven Woman Transformation Program (DWTP), a 26-week coaching
program for busy women over 40. Michael approves every quiz before clients see it.

Write 2 multiple-choice questions (3 for a long lesson) that check she understood the ONE or TWO most useful ideas, the ones that change
what she does this week. Each question has 3 answer options; exactly one is right. Wrong options are plausible mistakes, not jokes,
and never shame or insult her. Plain, short language. The right answer is not always the longest or the first one.
Base everything only on the lesson; where the lesson contradicts the program rules below, follow the rules.

${PROGRAM_RULES}

Answer in exactly this format and nothing else:
Q: (question)
A: (option)
B: (option)
C: (option)
CORRECT: (A, B or C)
(blank line, then the next question)`;

export function parseQuiz(text: string): QuizQ[] {
  return text.split(/\n\s*(?=Q:)/).map((block) => {
    const get = (k: string) => block.match(new RegExp(`^\\s*${k}:\\s*(.+)$`, "m"))?.[1]?.trim() ?? "";
    const options = ["A", "B", "C", "D"].map(get).filter(Boolean);
    const correct = "ABCD".indexOf(get("CORRECT").charAt(0).toUpperCase());
    return { q: get("Q"), options, correct };
  }).filter((x) => x.q && x.options.length >= 2 && x.correct >= 0 && x.correct < x.options.length);
}

export async function draftQuiz(supabase: SupabaseClient, lessonId: string): Promise<QuizQ[]> {
  const { data: l } = await supabase.from("lessons").select("kind, number, title, body, week_number").eq("id", lessonId).single();
  if (!l) throw new Error("Lesson not found");
  let content = `${KIND_LABEL[l.kind] ?? l.kind} ${l.number}: ${l.title}\n\n${l.body ?? ""}`;
  if (l.kind === "hh" && l.week_number) {
    const medals = await weekMedals(supabase, l.week_number);
    content += `\n\nThis week's new medals and habits:\n${medals.map((m) => `- ${m.circle} Medal ${m.number} "${m.name}": ${m.items.map((i) => i.title).join("; ")}`).join("\n")}`;
  }
  const quiz = parseQuiz(await askClaude({ system: SYSTEM, content: [{ type: "text", text: content.slice(0, 12000) }], maxTokens: 1200 }));
  if (!quiz.length) throw new Error("The AI didn't return a quiz. Try again.");
  return quiz;
}
