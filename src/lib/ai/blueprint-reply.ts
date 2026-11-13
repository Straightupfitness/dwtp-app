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
open in the app. He talks to the camera in his own voice; your bullets show on screen while he records, like a teleprompter.

Bullets are glanceable fragments, under ~12 words, not sentences, no script. Use her actual words and numbers.

FIVE SECTIONS, in this order, with these exact headings, 1–3 bullets each (fewer is better):
## Open
- (thank her + one personal detail from her answers: her work, family, a fun fact, her dream)
## What stood out
- (2–3 specific insights from her answers: sleep score and 3 AM wakeups, bedtime, caffeine amount and last cup vs the 10-hour cutoff,
  alcohol, energy crash, stress and its cause, meals/breakfast/protein, tracking history, pain, menopause symptoms. Name the number and
  why it matters, in a few words.)
## Your roadmap
- (her 3 focus circles the app picked and why, in her terms; any fix-its; medals already credited for what she's doing)
## What got in the way
- (what she said got in the way every other time → how this time is different, in a few words)
## This week
- (one concrete first step before Monday, from her Week 1 Habits & Homework or her biggest lever; then invite one question in the app chat)

${PROGRAM_RULES}

HARD RULES: never invent anything she didn't say. If an answer is missing, skip it. Medical topics: "check with your doctor".
Output only the five sections in that format.`;

export async function blueprintReplyPoints(db: SupabaseClient, clientId: string): Promise<{ groups: PointGroup[]; at: string }> {
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
