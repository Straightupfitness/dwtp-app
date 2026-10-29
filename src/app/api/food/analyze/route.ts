import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { askClaude, parseJson, type ContentBlock } from "@/lib/ai/anthropic";
import type { FoodEstimate } from "@/lib/food";

export const maxDuration = 60;

const SYSTEM = `You estimate the nutrition of a meal for a women's fat-loss coaching app (DWTP).
You get a photo of the meal, a spoken or typed description, or both.
Return ONLY a JSON object, no other text:
{"items":[{"name":"","amount":"","calories":0,"protein_g":0,"fiber_g":0,"potassium_mg":0}],"notes":""}
Rules:
- One entry per food you can identify. Use USDA-style typical values.
- "amount" in everyday units (e.g. "6 oz", "1 medium", "1 cup", "2 tbsp").
- Spoken descriptions often repeat words or whole phrases (speech-to-text glitches): list each food ONCE, unless she clearly says she had it more than once ("two of", "another"). Never return the same food twice.
- If the description gives amounts or brands, use them over what the photo suggests.
- Include sauces, oils, butter, dressings and drinks: the "tiny calories" count.
- When unsure of portion size, assume a typical home portion and say so in "notes" (one short sentence).
- Whole numbers for calories and potassium; one decimal for protein and fiber.
- If it isn't food, return {"items":[],"notes":"I couldn't see any food in this."}`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { image, text } = (await req.json()) as { image?: string; text?: string };
  if (!image && !text?.trim()) return NextResponse.json({ error: "Add a photo or describe the meal." }, { status: 400 });

  const content: ContentBlock[] = [];
  if (image) {
    const m = image.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (!m) return NextResponse.json({ error: "Unreadable photo." }, { status: 400 });
    content.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
  }
  content.push({ type: "text", text: text?.trim() ? `Her description: ${text.trim()}` : "Estimate this meal." });

  try {
    const reply = await askClaude({ system: SYSTEM, content });
    const estimate = parseJson<FoodEstimate>(reply);
    // Belt and braces: the same food with the same amount listed twice in a row is a dictation repeat.
    estimate.items = (estimate.items ?? []).filter((it, i, a) => !a.slice(0, i).some((x) => x.name.trim().toLowerCase() === it.name.trim().toLowerCase() && x.amount.trim().toLowerCase() === it.amount.trim().toLowerCase())).slice(0, 20);
    return NextResponse.json(estimate);
  } catch (e) {
    console.error("food analyze failed", e);
    return NextResponse.json({ error: explain(String((e as Error).message ?? e)) }, { status: 502 });
  }
}

/** Turn setup problems into a message that says what to fix; everything else stays friendly. */
function explain(msg: string): string {
  if (msg.includes("ANTHROPIC_API_KEY is not set")) return "Setup: ANTHROPIC_API_KEY isn't reaching the app. Check it's in Vercel for Production, then redeploy.";
  if (msg.includes(" 401")) return "Setup: Anthropic rejected the API key (401). Re-copy the key into Vercel and redeploy.";
  if (/credit|billing|balance/i.test(msg)) return "Setup: the Anthropic account has no credit. Add credit at console.anthropic.com → Billing.";
  if (msg.includes(" 403")) return "Setup: the API key doesn't have permission (403). Check the key's workspace at console.anthropic.com.";
  if (msg.includes(" 404") || /model/i.test(msg)) return `Setup: model problem. ${msg.slice(0, 200)}`;
  if (msg.includes(" 429")) return "Too many requests right now. Wait a minute and try again.";
  if (msg.includes(" 529") || msg.includes(" 503")) return "The AI is busy right now. Try again in a minute.";
  if (msg.startsWith("Anthropic API")) return `AI error: ${msg.slice(0, 200)}`;
  return "The AI couldn't read that meal. Try again, or type it in.";
}
