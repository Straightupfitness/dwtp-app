import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { askClaude, type ContentBlock } from "./anthropic";
import { weekData } from "../coach-data";
import { questionLabels } from "../checkin";
import { PROGRAM_RULES } from "./voice";

// November 1: Michael wants talking points, not a script. He replies in his own words; the AI finds what to talk about.
const SYSTEM = `You prepare Michael Duivis's talking points for his weekly check-in reply to a client in his Driven Woman Transformation Program (DWTP),
a 26-week coaching program for busy women over 40: fix sleep first (the Circadian Reset), then food (calories always tracked), then strength.
Each step in a Capacity Circle is a MEDAL (never say "ring").
Michael replies in his own voice (usually a short video). Do NOT write a script or full sentences to read out. Give him short, specific bullet
points: what to talk about, with the exact days, meals, foods and numbers, so he can glance at them while he talks.
November 13, Michael: one quoted point per section, only the most important one. So in EACH section, pick the ONE thing that
matters most (the most revealing, emotional or highest-leverage) and skip the rest. One bullet per section; a second only if it's truly
essential. Each bullet: her words or the exact data (quoted, with day/meal/number) → what Michael should say back (a few words).
Under ~35 words per bullet. Fragments, not sentences. Skim-able at a glance.

FIVE SECTIONS, in this order:
1. Questions, concerns and issues: the single most important thing she asked, struggled with or hinted at (answers, video transcript,
   habit notes, low scores or big score changes vs last week). Her words in quotes → the answer or angle Michael's philosophy gives.
2. Worst foods: the ONE least healthy item in her food log this week: day + meal (e.g. "Tue Oct 27 · Meal 2") + the food + why in 2–5
   words (fried, sugar, ultra-processed, alcohol, under 40 g protein, way over/under her calories) → a simple swap.
3. Most nutrient-dense: the ONE best thing she ate: day + meal + the food → why (protein, fiber, potassium, superfood, quality meat,
   vegetables, fruit). Michael's superfoods: goji berries, holy basil seeds, pumpkin seeds, hemp hearts, chia, cacao nibs, moringa,
   microgreens, bone broth, kiwis, berries, sardines, eggs with yolks, Greek yogurt, sweet potatoes, cinnamon, flaxseed oil.
4. Daily weigh-ins: one bullet: days weighed in of 7 + trend (first → last, change) → what it means (on track, water/salt/period/travel).
5. Lowest-hanging fruit: the ONE next step that would help her most, small and specific (with the exact app steps if it's about logging:
   Food tab → Add meal; Today tab → today's weight → Log). Follow this priority:
   no recent weigh-ins → weigh in daily; weighing in but no food logs → log one meal a day; logging but inconsistent → consistent calories
   (a number or range), then protein; under ~1,200 kcal → eat more (never below 1,200); consistent on calories and protein → food quality
   (40 g+ protein every meal, vegetables, swaps); consistent and losing → change nothing.

${PROGRAM_RULES}

HARD RULES: never invent data. If there are no weigh-ins or food logs, say so in that section ("No food logged this week") and make
logging the lowest-hanging fruit. Use her numbers and the real dates from the data. No greetings, no sign-off, no script.

SPECIAL WEEKS (add a bullet to section 1 only when the context says so): Week 1 welcome and "Log Your Numbers"; Week 4 sleep checkpoint
(full-year upgrade if sleep is better; Sleep Better Guarantee only if relevant); Week 13 halfway; Week 24 renewal; diet-break weeks
(maintenance calories).

Answer in exactly this format, with these labels and nothing before or after:
WIN: (her biggest win this week, one short line)
OBSTACLE: (her main obstacle, one short line)
QUESTIONS: (what she asked, one short line, or "none")
FLAGS: (health or safety concerns, upsell or renewal moments, missing data; separated by " | ", or "none")
POINTS:
## Questions, concerns and issues
- …
## Worst foods
- …
## Most nutrient-dense
- …
## Daily weigh-ins
- …
## Lowest-hanging fruit
- …`;

const dayLabel = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** Draft Michael's reply to a check-in and save it (plus a short summary for him). */
export async function generateDraft(supabase: SupabaseClient, checkinId: string) {
  const { data: c } = await supabase.from("checkins").select("*").eq("id", checkinId).single();
  if (!c) throw new Error("Check-in not found");
  const d = await weekData(supabase, c.client_id, c.week_number);
  const labels = questionLabels();
  const answers = Object.entries(c.answers ?? {}).filter(([k]) => !["habits", "sleep_photos", "videos"].includes(k))
    .map(([k, v]) => `- ${labels[k] ?? k}: ${Array.isArray(v) ? v.join("; ") : v}`).join("\n");
  const habitAnswers = ((c.answers?.habits ?? []) as { title: string; status: string; note?: string }[])
    .map((h) => `- ${h.title}: ${h.status}${h.note ? ` (${h.note})` : ""}`).join("\n");

  const context = `CLIENT: ${d.profile?.full_name ?? "(no name)"} · ${c.week_number >= 1 ? `Week ${c.week_number}` : "Pre-launch check-in (before her 26 weeks start Nov 16; no special week)"} · phase ${d.phase ?? "?"} · check-in type ${d.checkinType ?? "standard"}${d.dietBreak ? " · DIET BREAK WEEK" : ""}${d.moments.length ? ` · moments: ${d.moments.join(", ")}` : ""}
Plan: ${d.profile?.plan ?? "unknown"} · start weight ${d.profile?.start_weight_lbs ?? "?"} lbs · goal ${d.profile?.goal_weight_lbs ?? "?"} lbs · strength ${d.profile?.strength_days_per_week ?? "?"}x/week
Calorie target: ${d.target?.calorie_target ?? "not set yet"} · maintenance: ${d.target?.maintenance_calories ?? "not set yet"} · protein target: ${d.target?.protein_g ?? "120"} g
Focus circles: ${d.focus.join(", ")}
Open medals: ${d.openRings.join("; ") || "none"}
Michael's notes on her: ${d.profile?.coach_notes || "none"}
7X summary: ${d.assessment?.ai_summary || "none"}

SCORES this week (1–10): sleep ${c.sleep ?? "-"}, energy ${c.energy ?? "-"}, stress ${c.stress ?? "-"}, hunger ${c.hunger ?? "-"}
Previous weeks: ${d.previous.map((p) => `wk${p.week_number} sleep ${p.sleep} energy ${p.energy} stress ${p.stress} hunger ${p.hunger}`).join(" | ") || "none"}

HER ANSWERS:
${answers || "(none)"}
${c.video_path ? (c.transcript ? `HER VIDEO (transcript):\n${c.transcript}` : "(She sent a video; no transcript yet. Michael has watched it.)") : ""}

NEW HABITS THIS WEEK (her self-report):
${habitAnswers || "(none)"}

HABITS (current streak, of 14 days):
${d.habits.map((h) => `- ${h.circle}: ${h.title}: ${h.complete ? "complete" : `${h.streak} days`}`).join("\n") || "(none)"}

WEIGHT (last 3 weeks): ${d.weights.map((w) => `${dayLabel(w.log_date)}: ${w.weight_lbs}`).join(", ") || "NO WEIGHTS LOGGED"}
Weigh-ins this week (${dayLabel(d.start)} to ${dayLabel(d.end)}): ${d.weekWeights.length} of 7. Last weight: ${d.lastWeight ? `${d.lastWeight.weight_lbs} lbs on ${d.lastWeight.log_date}` : "none"}

STEPS (she logs them in the app) AND SLEEP (per day): ${d.days.map((x) => `${x.date}: ${x.steps ?? "-"} steps, ${x.sleepMin != null ? (x.sleepMin / 60).toFixed(1) + " h sleep" : "- sleep"}`).join(" | ")}

FOOD THIS WEEK (${d.start} to ${d.end}):
${d.days.map((x) => `${dayLabel(x.date)}: ${x.meals ? `${x.meals} meals, ${x.calories} kcal, ${x.protein} g protein, ${x.fiber} g fiber\n${x.list.map((m) => `  ${m.slot} (${m.time}): ${m.calories} kcal, ${m.protein} g protein, ${m.fiber} g fiber: ${m.items.slice(0, 15).join("; ")}`).join("\n")}` : "nothing logged"}`).join("\n")}

MICHAEL'S LAST REPLIES (to stay consistent with what he asked her to do):
${d.previous.map((p) => { const r = Array.isArray(p.checkin_replies) ? p.checkin_replies[0] : p.checkin_replies; return r?.final_text ? `Week ${p.week_number}: ${r.final_text.slice(0, 900)}` : null; }).filter(Boolean).join("\n---\n") || "none"}`;

  // Her sleep screenshots (from whatever she tracks sleep with), so the draft can use the real numbers.
  const shots: ContentBlock[] = [];
  for (const path of ((c.answers?.sleep_photos ?? []) as string[]).slice(0, 3)) {
    const { data: file } = await supabase.storage.from("checkin-videos").download(path);
    if (file) shots.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: Buffer.from(await file.arrayBuffer()).toString("base64") } });
  }
  const sleepNote = shots.length ? `\n\nHER SLEEP SCREENSHOTS (${shots.length}, attached): read her sleep from them (hours per night, sleep score, wakeups, trends) and use the real numbers in section 1 where it matters.` : "";
  const reply = await askClaude({ system: SYSTEM, content: [{ type: "text", text: context + sleepNote }, ...shots], maxTokens: 6000 });
  const out = parseDraft(reply);
  await supabase.from("checkins").update({ ai_summary: out.summary }).eq("id", c.id);
  await supabase.from("checkin_replies").upsert({ checkin_id: c.id, ai_draft: out.draft, updated_at: new Date().toISOString() }, { onConflict: "checkin_id" });
  return out;
}

/** Read the labeled answer. Plain text, so quotes can't break it. The talking points are saved as the draft. */
function parseDraft(text: string) {
  const line = (label: string) => text.match(new RegExp(`^\\s*${label}:\\s*(.*)$`, "mi"))?.[1]?.trim() ?? "";
  const i = text.search(/^\s*(POINTS|DRAFT):/mi);
  const draft = (i >= 0 ? text.slice(i).replace(/^\s*(POINTS|DRAFT):\s*/i, "") : text).trim();
  if (!draft) throw new Error("The AI didn't return talking points");
  const none = (v: string) => (/^none\.?$/i.test(v) ? "" : v);
  const flags = none(line("FLAGS")).split("|").map((f) => f.trim()).filter(Boolean);
  return { summary: { win: none(line("WIN")), obstacle: none(line("OBSTACLE")), questions: none(line("QUESTIONS")), flags, report: [] as { label: string; text: string }[] }, draft };
}
