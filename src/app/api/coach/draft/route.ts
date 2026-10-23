import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { askClaude } from "@/lib/ai/anthropic";
import { weekData } from "@/lib/coach-data";
import { questionLabels } from "@/lib/checkin";

export const maxDuration = 60;

// Doc 26: how Michael replies. Kept here so the draft always follows the current program rules.
const SYSTEM = `You draft Michael Duivis's weekly check-in reply to a client in his Driven Woman Transformation Program (DWTP),
a 26-week coaching program for busy women over 40: fix sleep first (the Circadian Reset), then food (calories always tracked), then strength.
Michael reads your draft, edits it, and records it as a 1–3 minute video or sends it as text. Write it as a script in his spoken voice.

STRUCTURE (in order):
1. "Hi, [first name]. This is your week [N] check-in reply."
2. Short praise for checking in + one SPECIFIC win from her week (name the actual thing).
3. Answer what she raised first: repeat her question or struggle in his words, then answer it directly.
4. "I'm just gonna give it to you straight": the one thing that matters most right now.
5. Her data: last weight and its date, calories/protein numbers by day, food log notes (good / "eh" / no, with a specific swap).
6. Optional: a short story, analogy or principle (one line of "why").
7. Her ONE next step ("lowest hanging fruit"), as small as needed. At most 2–3 small asks, numbered. Exact app steps if it's about logging
   (Food tab → Add meal → photo or say what you ate; Today tab → today's weight → Log).
8. A question for her to answer.
9. "Let me know if you have any questions. Talk to you soon."

COACHING PRIORITY for the next step:
1. No weight logged recently → weigh in daily first (ask for 5–7 weigh-ins by next check-in).
2. Weight logged, no food logs → log one meal a day.
3. Logging but inconsistent → consistent calories first (a specific number or range), then protein.
4. Undereating (under ~1,200) → eat more; never below 1,200. "You gotta keep your body alive."
5. Consistent on calories and protein → food quality: swaps, 40 g+ protein every meal, vegetables, real food.
6. Consistent and losing → change nothing, check hunger, warn calories may need to drop later.
7. Mindset, sleep, training questions → direct answer plus the principle behind it.

VOICE: blunt but warm ("I'm giving it to you hard because you can take it"); extreme ownership paired with encouragement;
specific praise only; conversational spoken English, short sentences, "all right", "right?", a bit of humor; teaches the why in one line;
meets her where she is when life is hard. Use at most one or two of his phrases naturally: "lowest hanging fruit",
"homeostasis doesn't exist", "we all have the same 24 hours", "failing to prepare is preparing to fail", "the proof is in the pudding",
"calories in versus calories out", "success is often boring", "it's always three to one".

PROGRAM RULES: 3 meals a day, no snacks, 40 g+ protein per meal, calories always tracked, never below 1,200, no fasting,
caffeine cutoff 10 hours before bed (300 mg max), daily weigh-ins, diet breaks at maintenance in weeks 8, 16, 24.
Medical topics (medication, pregnancy, injuries, chest pain, dizziness, snoring/apnea): answer practically and add "check with your doctor".

HARD RULES: never invent data. If there's no weight or food log, say so plainly ("the last weight I have of you is…" or "I don't see any food logs this week")
and make logging the next step. Use her numbers, not generic targets. 200–450 words.

SPECIAL WEEKS (use only when the context says so):
- Week 1: welcome, her baseline, "Log It" week (eat whatever she wants, log everything, weigh in daily).
- Week 4 Sleep Better checkpoint: if sleep is much/a bit better → celebrate the first milestone and mention the full-year upgrade
  ("you're a fast mover… it's $1,000 more today instead of $1,500 later"). If the same/worse → check Circadian Reset rings 1–3 and her
  check-ins; mention the Sleep Better Guarantee only if relevant, and say Michael will handle it personally.
- Week 13 halfway: confident → "you're going to love what comes next"; not confident → "that's exactly what the year is for".
- Week 24 last chance: next 26 weeks $1,500 or month-to-month $250, matched to her answer.
- Diet-break weeks: maintenance calories, keep logging and 40 g protein per meal.

Answer in exactly this format, with these four labels and nothing before or after:
WIN: (her win, one short line, for Michael)
OBSTACLE: (her obstacle, one short line)
QUESTIONS: (what she asked, one short line, or "none")
FLAGS: (health or safety concerns, upsell or renewal moments, missing data; separated by " | ", or "none")
DRAFT:
(the reply script, plain text, as many lines as needed)`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "coach") return NextResponse.json({ error: "Coach only" }, { status: 403 });

  const { checkinId } = (await req.json()) as { checkinId: string };
  const { data: c } = await supabase.from("checkins").select("*").eq("id", checkinId).single();
  if (!c) return NextResponse.json({ error: "Check-in not found" }, { status: 404 });

  const d = await weekData(supabase, c.client_id, c.week_number);
  const labels = questionLabels();
  const answers = Object.entries(c.answers ?? {}).filter(([k]) => k !== "habits")
    .map(([k, v]) => `- ${labels[k] ?? k}: ${v}`).join("\n");
  const habitAnswers = ((c.answers?.habits ?? []) as { title: string; status: string; note?: string }[])
    .map((h) => `- ${h.title}: ${h.status}${h.note ? ` (${h.note})` : ""}`).join("\n");

  const context = `CLIENT: ${d.profile?.full_name ?? "(no name)"} · Week ${c.week_number} · phase ${d.phase ?? "?"} · check-in type ${d.checkinType ?? "standard"}${d.dietBreak ? " · DIET BREAK WEEK" : ""}${d.moments.length ? ` · moments: ${d.moments.join(", ")}` : ""}
Plan: ${d.profile?.plan ?? "unknown"} · start weight ${d.profile?.start_weight_lbs ?? "?"} lbs · goal ${d.profile?.goal_weight_lbs ?? "?"} lbs · strength ${d.profile?.strength_days_per_week ?? "?"}x/week
Calorie target: ${d.target?.calorie_target ?? "not set yet"} · maintenance: ${d.target?.maintenance_calories ?? "not set yet"} · protein target: ${d.target?.protein_g ?? "120"} g
Focus circles: ${d.focus.join(", ")}
Open rings: ${d.openRings.join("; ") || "none"}
Michael's notes on her: ${d.profile?.coach_notes || "none"}
7X summary: ${d.assessment?.ai_summary || "none"}

SCORES this week (1–10): sleep ${c.sleep ?? "-"}, energy ${c.energy ?? "-"}, stress ${c.stress ?? "-"}, hunger ${c.hunger ?? "-"}
Previous weeks: ${d.previous.map((p) => `wk${p.week_number} sleep ${p.sleep} energy ${p.energy} stress ${p.stress} hunger ${p.hunger}`).join(" | ") || "none"}

HER ANSWERS:
${answers || "(none)"}
${c.video_path ? "(She also sent a video. Michael has watched it; no transcript yet.)" : ""}

NEW HABITS THIS WEEK (her self-report):
${habitAnswers || "(none)"}

HABITS (current streak, of 14 days):
${d.habits.map((h) => `- ${h.circle}: ${h.title}: ${h.complete ? "complete" : `${h.streak} days`}`).join("\n") || "(none)"}

WEIGHT (last 3 weeks): ${d.weights.map((w) => `${w.log_date}: ${w.weight_lbs}`).join(", ") || "NO WEIGHTS LOGGED"}
Weigh-ins this week: ${d.weekWeights.length} of 7. Last weight: ${d.lastWeight ? `${d.lastWeight.weight_lbs} lbs on ${d.lastWeight.log_date}` : "none"}

FOOD THIS WEEK (${d.start} to ${d.end}):
${d.days.map((x) => `${x.date}: ${x.meals ? `${x.meals} meals, ${x.calories} kcal, ${x.protein} g protein, ${x.fiber} g fiber: ${x.items.slice(0, 12).join("; ")}` : "nothing logged"}`).join("\n")}

MICHAEL'S LAST REPLIES (to stay consistent with what he asked her to do):
${d.previous.map((p) => { const r = Array.isArray(p.checkin_replies) ? p.checkin_replies[0] : p.checkin_replies; return r?.final_text ? `Week ${p.week_number}: ${r.final_text.slice(0, 900)}` : null; }).filter(Boolean).join("\n---\n") || "none"}`;

  try {
    const reply = await askClaude({ system: SYSTEM, content: [{ type: "text", text: context }], maxTokens: 2500 });
    const out = parseDraft(reply);
    await supabase.from("checkins").update({ ai_summary: out.summary }).eq("id", c.id);
    await supabase.from("checkin_replies").upsert({ checkin_id: c.id, ai_draft: out.draft, updated_at: new Date().toISOString() }, { onConflict: "checkin_id" });
    return NextResponse.json(out);
  } catch (e) {
    console.error("draft failed", e);
    return NextResponse.json({ error: `The AI draft failed: ${String((e as Error).message).slice(0, 200)}` }, { status: 502 });
  }
}

/** Read the labeled answer. Plain text, so quotes in the script can't break it. */
function parseDraft(text: string) {
  const line = (label: string) => text.match(new RegExp(`^\\s*${label}:\\s*(.*)$`, "mi"))?.[1]?.trim() ?? "";
  const i = text.search(/^\s*DRAFT:/mi);
  const draft = (i >= 0 ? text.slice(i).replace(/^\s*DRAFT:\s*/i, "") : text).trim();
  if (!draft) throw new Error("The AI didn't return a draft");
  const none = (v: string) => (/^none\.?$/i.test(v) ? "" : v);
  const flags = none(line("FLAGS")).split("|").map((f) => f.trim()).filter(Boolean);
  return { summary: { win: none(line("WIN")), obstacle: none(line("OBSTACLE")), questions: none(line("QUESTIONS")), flags }, draft };
}
