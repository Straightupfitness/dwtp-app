import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { askClaude } from "./anthropic";
import { PROGRAM_RULES } from "./voice";
import { BLUEPRINT, blueprintDone } from "../blueprint";
import { addDays } from "../daily";
import { todayIn } from "../program";

/**
 * November 13: Michael's "last 48 hours" button. What she's been doing in the app, in bullets, and a short flow of
 * talking points for a personal message (app chat + text). Bullets only, never a script: he writes it in his voice.
 */
export type Brief = { status: string; doing: string[]; points: string[]; at: string; hours: number; topic: string };
export type BlueprintState = "done" | "started" | "not-started";

const SYSTEM = `You help Michael Duivis, a fitness coach, write a short personal message to ONE client of his Driven Woman Transformation
Program (busy women over 40; sleep first, then food with calories always tracked, then strength). He sends it in the app chat and as a
text from his phone, so it must feel one-on-one. You do NOT write the message. You give him bullets so he writes it in his own voice.

Everyone starts the new 26-week program on Monday, November 16. Before that, every client fills in her Driven Woman Blueprint in the app
(a welcome video + 19 questions, about 10–15 minutes). It builds her custom roadmap: 3 focus circles, fix-its for pain/menopause/travel,
and credit for habits she already does. The moment she sends it, her Week 1 Habits & Homework opens (a head start).

Answer in exactly this format, nothing before or after:
STATUS: (one short line: where she stands, e.g. "Blueprint not started · logging daily · last in the app 3 h ago")
DOING:
- (4–6 bullets: what she actually did in the app in the window, with real days and numbers: food logged, protein, weigh-ins and trend,
  steps, water, habits ticked, workouts, lessons watched, chat messages, community posts, Blueprint progress. Say plainly when
  something is missing, e.g. "No food logged since Wed". Include when she was last in the app.)
POINTS:
- (3–5 bullets, in order, the flow of his message. Fragments under ~15 words, not sentences, no quotes to read out.
  1st: a specific, personal opener from her data (a win, or something she said). Then the goal for this message. Then make it easy or
  answer her likely objection. Last: the close or the one next step.)

GOAL FOR THE POINTS, by topic:
- blueprint, not started: get her to do it before Sunday night. Why it matters for HER (tie to her data or goal). Make it easy
  (10–15 minutes, Today tab opens it). Mention the head start: Week 1 opens the moment she sends it.
- blueprint, started: she stopped partway (the screen is in the data). Acknowledge, maybe ask what stopped her there, nudge to finish
  before Sunday; her answers are saved.
- blueprint, done: feedback on her Blueprint. 1–2 specific insights from her answers (sleep, caffeine, stress, what got in the way before,
  her dream), what the app picked as her focus and why, point her to her Week 1 Habits & Homework, invite one question. Monday start.
- general: whatever would help her most right now (the lowest-hanging fruit), from her data.

${PROGRAM_RULES}

HARD RULES: never invent data; use only what's given. Don't repeat what Michael already told her in his recent messages; build on it.
Vary the opener: never a generic "hope you're well". No greetings, no sign-off, no full sentences to read out.`;

const dayLabel = (iso: string, tz: string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
const dateLabel = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const ago = (iso: string | null) => {
  if (!iso) return "never (no record)";
  const h = Math.round((Date.now() - Date.parse(iso)) / 3_600_000);
  return h < 1 ? "less than an hour ago" : h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
};

export function blueprintState(submittedAt: string | null | undefined, answers: Record<string, unknown> | null | undefined): BlueprintState {
  if (blueprintDone(submittedAt)) return "done";
  const a = answers ?? {};
  // Same rule as the roster: answers saved but not sent (an old pre-November 10 assessment counts as not started).
  return !submittedAt && Object.keys(a).some((k) => k !== "previous") ? "started" : "not-started";
}

export async function clientBrief(db: SupabaseClient, clientId: string, opts: { hours?: number; topic?: string } = {}): Promise<Brief> {
  const hours = opts.hours ?? 48;
  const sinceIso = new Date(Date.now() - hours * 3_600_000).toISOString();
  const { data: p } = await db.from("profiles")
    .select("full_name, timezone, program_start, start_weight_lbs, goal_weight_lbs, coach_notes, last_seen_at, step_goal").eq("id", clientId).single();
  const tz = (p?.timezone as string | null) ?? "America/Los_Angeles";
  const today = todayIn(tz);
  const sinceDay = addDays(today, -Math.ceil(hours / 24));

  const [{ data: a }, { data: food }, { data: weights }, { data: steps }, { data: water }, { data: habits }, { data: workouts },
    { data: lessons }, { data: msgs }, { data: posts }, { data: target }, { data: checkins }] = await Promise.all([
    db.from("assessments").select("answers, submitted_at, ai_summary").eq("client_id", clientId).maybeSingle(),
    db.from("food_logs").select("eaten_at, meal_slot, calories, protein_g, items").eq("client_id", clientId).gte("eaten_at", sinceIso).order("eaten_at"),
    db.from("weight_logs").select("log_date, weight_lbs").eq("client_id", clientId).gte("log_date", addDays(today, -14)).order("log_date"),
    db.from("health_days").select("day, steps").eq("client_id", clientId).gte("day", sinceDay).order("day"),
    db.from("water_days").select("day, oz").eq("client_id", clientId).gte("day", sinceDay).order("day"),
    db.from("habit_logs").select("log_date, ring_items(title)").eq("client_id", clientId).gte("log_date", sinceDay),
    db.from("workout_sessions").select("completed_at, workouts(name)").eq("client_id", clientId).gte("completed_at", sinceIso),
    db.from("lesson_progress").select("watched_at, lessons(title, kind, week_number)").eq("client_id", clientId).gte("watched_at", sinceIso),
    db.from("messages").select("sender_id, body, created_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(8),
    db.from("posts").select("body, created_at").eq("author_id", clientId).gte("created_at", sinceIso),
    db.from("nutrition_targets").select("calorie_target, protein_g").eq("client_id", clientId).maybeSingle(),
    db.from("checkins").select("week_number, submitted_at").eq("client_id", clientId).gte("submitted_at", sinceIso),
  ]);

  const answers = (a?.answers ?? {}) as Record<string, unknown>;
  const state = blueprintState(a?.submitted_at as string | null, answers);
  const topic = opts.topic ?? "general";
  let bp = `Blueprint: ${state}`;
  if (state === "started") {
    const stop = BLUEPRINT.findIndex((s) => s.fields.every((f) => answers[f.id] === undefined || answers[f.id] === "") && !s.fields.every((f) => f.optional));
    bp += ` · stopped at screen ${stop + 1} of ${BLUEPRINT.length}: "${BLUEPRINT[Math.max(0, stop)]?.title}"`;
  }
  if (state === "done") {
    const labels: Record<string, string> = {};
    for (const s of BLUEPRINT) for (const f of s.fields) labels[f.id] = f.kind === "open" ? s.title : f.label;
    const lines = Object.entries(answers).filter(([k, v]) => labels[k] && v !== "" && v != null).map(([k, v]) => `  ${labels[k]}: ${Array.isArray(v) ? v.join(", ") : String(v).slice(0, 400)}`);
    const assigned = answers.assigned as { focus?: string[]; fixits?: string[]; skipped?: string[] } | undefined;
    bp += ` · sent ${dayLabel(a!.submitted_at as string, tz)}\nHer answers:\n${lines.join("\n")}`;
    if (assigned) bp += `\nThe app picked: focus ${assigned.focus?.join(", ") || "-"} · fix-its ${assigned.fixits?.join(", ") || "none"} · already-done medals: ${assigned.skipped?.join("; ") || "none"}`;
    if (a?.ai_summary) bp += `\nSummary (incl. her video answers): ${String(a.ai_summary).slice(0, 2500)}`;
  }

  const byDay = new Map<string, { kcal: number; protein: number; meals: string[] }>();
  for (const m of food ?? []) {
    const d = todayIn(tz, new Date(m.eaten_at as string));
    const x = byDay.get(d) ?? { kcal: 0, protein: 0, meals: [] };
    x.kcal += Number(m.calories ?? 0); x.protein += Number(m.protein_g ?? 0);
    x.meals.push(((m.items ?? []) as { name: string }[]).map((i) => i.name).slice(0, 6).join(", "));
    byDay.set(d, x);
  }
  const coachMsgs = (msgs ?? []).reverse().map((m) => `${dayLabel(m.created_at as string, tz)} ${m.sender_id === clientId ? "HER" : "MICHAEL"}: ${String(m.body ?? "(attachment)").slice(0, 300)}`);

  const context = `TOPIC: ${topic}
CLIENT: ${p?.full_name ?? "(no name)"} · program starts ${p?.program_start ?? "?"} · start ${p?.start_weight_lbs ?? "?"} lbs · goal ${p?.goal_weight_lbs ?? "?"} lbs
Targets: ${target?.calorie_target ?? "calories not set yet"} kcal · protein ${target?.protein_g ?? 120} g · steps ${p?.step_goal ?? 10000}
Michael's notes on her: ${p?.coach_notes || "none"}
Last in the app: ${ago(p?.last_seen_at as string | null)}
WINDOW: the last ${hours} hours (since ${dayLabel(sinceIso, tz)}); today is ${dateLabel(today)}

${bp}

FOOD (window): ${[...byDay.entries()].map(([d, x]) => `${dateLabel(d)}: ${x.meals.length} meals, ${Math.round(x.kcal)} kcal, ${Math.round(x.protein)} g protein (${x.meals.join(" | ")})`).join("\n") || "nothing logged"}
WEIGHT (last 14 days): ${(weights ?? []).map((w) => `${dateLabel(w.log_date as string)} ${w.weight_lbs}`).join(", ") || "no weigh-ins"}
STEPS: ${(steps ?? []).map((s) => `${dateLabel(s.day as string)} ${s.steps ?? "-"}`).join(", ") || "none logged"}
WATER: ${(water ?? []).map((w) => `${dateLabel(w.day as string)} ${w.oz} oz`).join(", ") || "none logged"}
HABITS TICKED: ${(habits ?? []).length ? (habits ?? []).map((h) => `${dateLabel(h.log_date as string)} ${(h.ring_items as unknown as { title: string } | null)?.title ?? "habit"}`).join("; ") : "none"}
WORKOUTS DONE: ${(workouts ?? []).map((w) => `${dayLabel(w.completed_at as string, tz)} ${(w.workouts as unknown as { name: string } | null)?.name ?? "workout"}`).join("; ") || "none"}
LESSONS WATCHED: ${(lessons ?? []).map((l) => { const x = l.lessons as unknown as { title: string; kind: string; week_number: number } | null; return `${x?.kind?.toUpperCase()} week ${x?.week_number}: ${x?.title}`; }).join("; ") || "none"}
CHECK-INS SENT: ${(checkins ?? []).map((c) => `week ${c.week_number}`).join(", ") || "none"}
COMMUNITY POSTS: ${(posts ?? []).map((x) => String(x.body ?? "(photo)").slice(0, 200)).join(" | ") || "none"}

RECENT CHAT (oldest first; don't repeat what Michael already said):
${coachMsgs.join("\n") || "no messages"}`;

  const text = await askClaude({ system: SYSTEM, content: [{ type: "text", text: context }], maxTokens: 1500 });
  const block = (label: string) => {
    const m = text.match(new RegExp(`^\\s*${label}:\\s*$([\\s\\S]*?)(?=^\\s*[A-Z]+:\\s*$|$(?![\\s\\S]))`, "m"));
    return (m?.[1] ?? "").split("\n").map((l) => l.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean);
  };
  const status = text.match(/^\s*STATUS:\s*(.+)$/m)?.[1]?.trim() ?? "";
  const doing = block("DOING"), points = block("POINTS");
  if (!doing.length && !points.length) throw new Error("The AI didn't return bullets. Try again.");
  return { status, doing, points, at: new Date().toISOString(), hours, topic };
}
