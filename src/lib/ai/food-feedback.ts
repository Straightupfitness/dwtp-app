import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { askClaude } from "./anthropic";
import { PROGRAM_RULES } from "./voice";
import { loadFoodWeek } from "../food-week";
import { addDays } from "../daily";
import { programWeek } from "../program";

/**
 * November 7: Michael's daily food feedback. One short text about one day of her food log, a compliment sandwich:
 * what she did well, the one thing to improve, and a push for tomorrow. Built from her goals, her week and what
 * he's told her before. He edits it and sends it himself (app chat or text message).
 */
const SYSTEM = `You draft a short daily text message from Michael Duivis, a fitness coach, to one client in his Driven Woman
Transformation Program (busy women over 40; sleep first, then food with calories always tracked, then strength).
The message is about ONE day of her food log. Michael sends it as a text, so it must be short, warm and personal.

SHAPE (a compliment sandwich), 3 short parts, 45–80 words in total, plain text, no headings, no bullet points, no emojis:
1. Open with "Hey [first name]," and ONE specific thing she did well that day: name the actual food, meal or number
   (e.g. "42 g protein at breakfast with those eggs and Greek yogurt"). Never generic praise.
2. ONE area to improve, if there is a real one: the single biggest lever for her, with a concrete swap or addition
   (name the food and what to use instead, or how much). If the day was genuinely on point, say so and skip the fix.
3. ONE short line for tomorrow: motivating and practical, tied to her goal or what she's working on.

PRIORITIES for the one fix (pick the first that applies):
- Under ~1,200 kcal: she needs to eat more (never praise undereating).
- Fewer than 3 meals, or a meal well under 40 g protein: protein at every meal (name a simple add: eggs, Greek yogurt,
  chicken, protein powder, cottage cheese, lean ground beef 93%).
- Well over her calorie target: the one food that cost the most, and a swap.
- Fried, sugary, ultra-processed or alcohol: one swap.
- Fiber or vegetables low: one easy add (berries, kiwi, chia, a big salad, roasted veg).
- Consistent and on target: "keep doing exactly this" (success is often boring).

VOICE: Michael talking: blunt but warm, short sentences, conversational ("all right", "boom", "right?" sparingly).
Use her numbers and her foods from the log. If she has a goal weight, a recent trend or something Michael asked her to
work on, connect to it in a few words. Vary the wording from the earlier messages listed (don't repeat the same praise
or fix two days running unless it's still the main issue, then say so: "same as yesterday: ...").

${PROGRAM_RULES}

HARD RULES: never invent foods or numbers; only use what's in the log. No sign-off, no "Michael", no quotation marks
around the message. Output ONLY the message text.`;

const dayLabel = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });

export async function draftFoodFeedback(supabase: SupabaseClient, clientId: string, day: string): Promise<string> {
  const [{ data: p }, week, { data: weights }, { data: a }, prior, { data: lastReply }] = await Promise.all([
    supabase.from("profiles").select("full_name, goal_weight_lbs, start_weight_lbs, coach_notes, program_start").eq("id", clientId).single(),
    loadFoodWeek(supabase, clientId, { count: 7, end: day }),
    supabase.from("weight_logs").select("log_date, weight_lbs").eq("client_id", clientId).gte("log_date", addDays(day, -14)).lte("log_date", day).order("log_date"),
    supabase.from("assessments").select("ai_summary").eq("client_id", clientId).maybeSingle(),
    supabase.from("food_feedback").select("day, sent_text").eq("client_id", clientId).lt("day", day).not("sent_text", "is", null)
      .order("day", { ascending: false }).limit(4).then((r) => r, () => ({ data: null })),
    supabase.from("checkins").select("week_number, checkin_replies(final_text)").eq("client_id", clientId).order("week_number", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const target = week.days.find((d) => d.date === day);
  if (!target?.meals.length) throw new Error("Nothing logged that day.");
  const first = (p?.full_name ?? "").trim().split(/\s+/)[0] || "there";
  const t = week.targets;
  const reply = (Array.isArray(lastReply?.checkin_replies) ? lastReply?.checkin_replies[0] : lastReply?.checkin_replies) as { final_text?: string } | null | undefined;
  const wk = p?.program_start ? programWeek(p.program_start, day) : 0;

  const context = `CLIENT: ${first} (${p?.full_name ?? ""})${wk >= 1 ? ` · program week ${wk}` : " · before her 26 weeks start"}
Goal: start ${p?.start_weight_lbs ?? "?"} lbs → goal ${p?.goal_weight_lbs ?? "?"} lbs
Targets: ${t.kcal ? `${t.kcal} kcal` : "no calorie target set yet"} · ${t.protein} g protein · ${t.fiber} g fiber
Michael's notes on her: ${p?.coach_notes || "none"}
Her 7X summary: ${(a?.ai_summary ?? "none").slice(0, 700)}
What Michael asked her to work on in his last check-in reply: ${reply?.final_text ? reply.final_text.slice(0, 600) : "none"}
Weight, last 2 weeks: ${(weights ?? []).map((w) => `${w.log_date.slice(5)}: ${w.weight_lbs}`).join(", ") || "none logged"}

THE DAY TO WRITE ABOUT: ${dayLabel(day)}: ${target.meals.length} meals, ${target.kcal} kcal, ${target.protein} g protein, ${target.fiber} g fiber
${target.meals.map((m) => `  ${m.slot} (${m.time}): ${m.kcal} kcal, ${m.protein} g protein, ${m.fiber} g fiber: ${m.items.map((i) => `${i.name} (${i.amount}, ${Math.round(i.calories)} kcal, ${Math.round(i.protein_g)} g P)`).join("; ") || m.description || "no details"}`).join("\n")}

THE 6 DAYS BEFORE (for patterns):
${week.days.filter((d) => d.date < day).map((d) => `${dayLabel(d.date)}: ${d.meals.length ? `${d.meals.length} meals, ${d.kcal} kcal, ${d.protein} g protein` : "nothing logged"}`).join("\n")}

MICHAEL'S LAST FOOD MESSAGES TO HER (vary from these):
${(prior?.data ?? []).map((f: { day: string; sent_text: string }) => `${f.day}: ${f.sent_text}`).join("\n") || "none yet"}`;

  const text = await askClaude({ system: SYSTEM, content: [{ type: "text", text: context }], maxTokens: 1200 });
  return text.trim().replace(/^["“]|["”]$/g, "");
}
