import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { askClaude } from "./anthropic";
import { PROGRAM_RULES, VOICE } from "./voice";
import { weekData } from "../coach-data";
import { programWeek, todayIn } from "../program";

const SYSTEM = `You write Michael Duivis's Thursday morning voice note to one client in his Driven Woman Transformation Program (DWTP),
a 26-week coaching program for busy women over 40. He records it on his phone and texts it to her. Each step in a Capacity Circle is a
MEDAL (never say "ring"). Write it as a script in his spoken voice.

LENGTH: 30–60 seconds spoken: 80–150 words. One short paragraph or two. No lists, no headings, no emojis.

STRUCTURE:
1. "Hey [first name], it's Michael." (or a natural variation)
2. One or two REAL things going on with her right now, from her data: a specific win (a streak, a weigh-in trend, a great meal she logged,
   a medal she finished) and/or the one thing she's struggling with. Name the actual thing.
3. What's waiting for her in next week's Habits & Homework: the new medal(s) and habits, and in one line why they matter for her.
4. One small, doable ask before the weekend (or "keep doing exactly what you're doing").
5. A warm, short sign-off ("Talk soon." / "Proud of you.").

${VOICE}

${PROGRAM_RULES}

HARD RULES: never invent data. If she hasn't logged food or weight this week, say so kindly and make that the ask.
If there's no next-week information, talk about what she's working on now instead. Output only the script.`;

export async function thursdayScript(supabase: SupabaseClient, clientId: string) {
  const { data: p } = await supabase.from("profiles").select("full_name, timezone, program_start").eq("id", clientId).single();
  const today = todayIn(p?.timezone ?? "America/Los_Angeles");
  const week = Math.max(1, programWeek(p?.program_start ?? null, today));
  const [d, { data: next }, { data: nextWeek }, { data: last }] = await Promise.all([
    weekData(supabase, clientId, week),
    supabase.from("trajectory_week_rings").select("rings(name, ring_number, circles(name), ring_items(title, item_type, sort))").eq("week_number", week + 1),
    supabase.from("trajectory_weeks").select("phase, is_diet_break, moments").eq("week_number", week + 1).maybeSingle(),
    supabase.from("checkins").select("week_number, ai_summary, checkin_replies(final_text)").eq("client_id", clientId)
      .order("week_number", { ascending: false }).limit(1).maybeSingle(),
  ]);

  type R = { name: string; ring_number: number; circles: { name: string } | null; ring_items: { title: string; item_type: string; sort: number }[] };
  const medals = ((next ?? []) as unknown as { rings: R | null }[]).map((x) => x.rings).filter((r): r is R => !!r)
    .map((r) => `${r.circles?.name ?? ""} Medal ${r.ring_number} "${r.name}": ${[...r.ring_items].sort((a, b) => a.sort - b.sort).map((i) => i.title).join("; ")}`);
  const sinceMon = d.days.filter((x) => x.date <= today);
  const lastReply = Array.isArray(last?.checkin_replies) ? last?.checkin_replies[0] : last?.checkin_replies;
  const summary = (last?.ai_summary ?? {}) as { win?: string; obstacle?: string };

  const context = `CLIENT: ${p?.full_name ?? "(no name)"} · now in Week ${week} · today ${today}
NEXT WEEK (Week ${week + 1}${nextWeek?.phase ? `, ${nextWeek.phase} phase` : ""}${nextWeek?.is_diet_break ? ", DIET BREAK week" : ""}): ${medals.join(" | ") || "no new medals listed"}
Open medals now: ${d.openRings.join("; ") || "none"}
Habit streaks (of 14 days): ${d.habits.map((h) => `${h.title}: ${h.complete ? "complete" : h.streak}`).join("; ") || "none"}
Weight (last 3 weeks): ${d.weights.map((w) => `${w.log_date}: ${w.weight_lbs}`).join(", ") || "none logged"}
Food this week so far: ${sinceMon.map((x) => `${x.date}: ${x.meals ? `${x.meals} meals, ${x.calories} kcal, ${x.protein} g protein (${x.items.slice(0, 8).join("; ")})` : "nothing logged"}`).join(" | ")}
Calorie target: ${d.target?.calorie_target ?? "not set yet"} · protein target: ${d.target?.protein_g ?? 120} g
Last check-in (week ${last?.week_number ?? "-"}): win: ${summary.win || "-"} · obstacle: ${summary.obstacle || "-"}
What Michael told her last: ${lastReply?.final_text?.slice(0, 700) || "nothing yet"}
Michael's notes on her: ${d.profile?.coach_notes || "none"}`;

  const script = (await askClaude({ system: SYSTEM, content: [{ type: "text", text: context }], maxTokens: 800 })).trim();
  return { script, week, nextWeek: week + 1 };
}
