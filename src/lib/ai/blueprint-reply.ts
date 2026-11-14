import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { askClaude } from "./anthropic";
import { PROGRAM_RULES } from "./voice";
import { BLUEPRINT } from "../blueprint";

export type PointGroup = { h: string; items: string[] };

/**
 * November 13: talking points for Michael's video reply to her Driven Woman Blueprint. Bullets only (he talks; the
 * points sit on screen like a teleprompter while he records).
 */
const SYSTEM = `You prepare talking points for Michael Duivis's short video reply (2–4 minutes) to a client's Driven Woman Blueprint,
the 19-question intake for his Driven Woman Transformation Program (busy women over 40; 26 weeks: Rested → Fueled → Driven; sleep first,
then food with calories always tracked, then strength). The program starts Monday, November 16. Her Week 1 Habits & Homework is already
open in the app. He talks to the camera in his own voice; your points show on screen while he records, like a teleprompter.

November 13, Michael: "too vague; tell me what she actually said, and pick only the most important one in each category."
So: read everything she wrote and said (her video answers are in the summary). For each section, pick the ONE thing that matters most
(the most revealing, emotional or highest-leverage) and skip the rest. One bullet per section; a second only if it's truly essential.

EACH BULLET has two parts, separated by " → ":
  her words (a short direct quote in quotation marks, or her exact number/answer) → what Michael should say back (a few words: the angle,
  the why, or the one fix). Under ~35 words in total. No script, no full paragraph.
  Example: "I wake up at 3 AM and my mind races" (5–7 nights) → that's cortisol; the Circadian Reset fixes this first, by week 4

FIVE SECTIONS, in this order, with these exact headings:
## Open
- (the most personal thing she shared: work, family, fun fact, her six-month dream → a warm, specific opener)
## The big one
- (the single most important thing in her answers: the biggest pain point or lever, e.g. sleep, 3 AM wakeups, caffeine late in the day,
  alcohol, stress and its cause, skipping breakfast, low protein, pain, menopause symptoms → why it matters and what the program does)
## What got in the way
- ("what got in the way every other time", her words → why this time is different, specifically)
## Your roadmap
- (the 3 focus circles the app picked, tied to one thing she said; fix-its or already-credited medals only if relevant)
## This week
- (one concrete first step before Monday, tied to the big one or her Week 1 Habits & Homework → then: "ask me anything in the chat")

${PROGRAM_RULES}

HARD RULES: quote only what she actually wrote or said; never invent. If she skipped a question, use the next most important thing.
Medical topics: "check with your doctor". Output only the five sections in that format.`;

async function blueprintReplyPointsOnce(db: SupabaseClient, clientId: string): Promise<{ groups: PointGroup[]; at: string }> {
  const [{ data: p }, { data: a }] = await Promise.all([
    db.from("profiles").select("full_name, program_start, start_weight_lbs, goal_weight_lbs, coach_notes").eq("id", clientId).single(),
    db.from("assessments").select("answers, ai_summary, submitted_at").eq("client_id", clientId).maybeSingle(),
  ]);
  if (!a?.submitted_at) throw new Error("She hasn't sent her Blueprint yet.");
  const answers = (a.answers ?? {}) as Record<string, unknown>;
  const lines: string[] = [];
  for (const s of BLUEPRINT) for (const f of s.fields) {
    const v = answers[f.id];
    if (v === undefined || v === "" || v === null) continue;
    lines.push(`${f.kind === "open" ? s.title : f.label}: ${Array.isArray(v) ? v.join(", ") : String(v).slice(0, 600)}`);
  }
  const assigned = answers.assigned as { focus?: string[]; fixits?: string[]; skipped?: string[]; reasons?: string[] } | undefined;
  const context = `CLIENT: ${p?.full_name ?? "(no name)"} · starts ${p?.program_start ?? "Nov 16"} · goal ${p?.goal_weight_lbs ?? "?"} lbs
Michael's notes: ${p?.coach_notes || "none"}

HER BLUEPRINT ANSWERS:
${lines.join("\n")}

WHAT THE APP PICKED: focus ${assigned?.focus?.join(", ") || "-"} · fix-its ${assigned?.fixits?.join(", ") || "none"} · medals already credited: ${assigned?.skipped?.join("; ") || "none"}
Why: ${assigned?.reasons?.join("; ") || "-"}

SUMMARY (includes her video answers, transcribed):
${String(a.ai_summary ?? "none").slice(0, 4000)}`;
  const text = await askClaude({ system: SYSTEM, content: [{ type: "text", text: context }], maxTokens: 1500 });
  const groups: PointGroup[] = [];
  for (const raw of text.split("\n")) {
    const l = raw.trim();
    if (!l) continue;
    const h = l.match(/^#{1,4}\s*(.+)$/);
    if (h) { groups.push({ h: h[1].trim(), items: [] }); continue; }
    if (/^[-*•]/.test(l)) { if (!groups.length) groups.push({ h: "", items: [] }); groups[groups.length - 1].items.push(l.replace(/^[-*•]\s*/, "")); }
  }
  const out = groups.filter((g) => g.items.length);
  if (!out.length) throw new Error("The AI didn't return talking points. Try again.");
  return { groups: out, at: new Date().toISOString() };
}

/** November 13 (Daisy's "AI couldn't do it, try again"): one automatic retry when the AI hiccups or answers oddly. */
export async function blueprintReplyPoints(db: SupabaseClient, clientId: string): Promise<{ groups: PointGroup[]; at: string }> {
  try { return await blueprintReplyPointsOnce(db, clientId); }
  catch (e) {
    if (/hasn't sent her Blueprint/.test(String((e as Error).message))) throw e;
    console.error("blueprint reply: retrying", e);
    await new Promise((r) => setTimeout(r, 1500));
    return await blueprintReplyPointsOnce(db, clientId);
  }
}
