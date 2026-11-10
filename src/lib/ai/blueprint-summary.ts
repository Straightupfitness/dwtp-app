import "server-only";
import { askClaude } from "./anthropic";
import { blueprintLabels } from "../blueprint";

/**
 * November 10: a one-screen summary of her Driven Woman Blueprint for Michael's onboarding call, with the focus
 * circles the Circle System Design (doc 23, section 8) would pick from her answers.
 */
const SYSTEM = `You summarize a new client's Driven Woman Blueprint (intake answers) for her coach, Michael Duivis, to read
in two minutes before their 30-minute onboarding call. Plain text, no markdown headings, short lines.

Write, in this order:
1. One-line snapshot: age (from date of birth), height, current and goal weight, work and home life.
2. Sleep, energy, stress: her numbers and what stands out (3 AM wakeups, afternoon crash, causes of stress).
3. Food: meals and snacks, breakfast, tracking history, caffeine (amount and last time) and alcohol.
4. Body: pain or injuries, perimenopause/menopause symptoms, travel.
5. Her why and what got in the way before, in her words where possible.
6. Suggested focus circles (pick 3; default Circadian Reset, Food Philosophy, Cardio) using these rules:
   sleep <= 6 or bedtime after 11 PM -> Sleep is the priority; energy <= 6 or afternoon crash or 3+ caffeine -> Circadian Reset;
   stress >= 7 -> Mindset; knee pain -> Achy Knees fix-it; foot/heel pain -> Plantar Fasciitis fix-it;
   menopause symptoms -> Menopause Symptoms fix-it; travels monthly or weekly -> Travel fix-it (doesn't count toward 3).
   Give one short reason for each.
7. Three questions Michael should ask on the call.
Never invent facts. If an answer is missing, skip it.`;

export async function summarizeBlueprint(answers: Record<string, unknown>, transcripts: string): Promise<string> {
  const labels = blueprintLabels();
  const lines = Object.entries(answers).filter(([k]) => k !== "videos")
    .map(([k, v]) => `- ${labels[k] ?? k}: ${Array.isArray(v) ? v.join(", ") : v}`).join("\n");
  const today = new Date().toISOString().slice(0, 10);
  const text = await askClaude({ system: SYSTEM, content: [{ type: "text", text: `Today: ${today}\n\nHER ANSWERS:\n${lines}${transcripts ? `\n\nHER VIDEO ANSWERS (transcribed):\n${transcripts}` : ""}` }], maxTokens: 1500 });
  return text.trim();
}
