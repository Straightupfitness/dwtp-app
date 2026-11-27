import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { askClaude, parseJson } from "@/lib/ai/anthropic";
import type { GoItem } from "@/lib/go-to";

export const maxDuration = 60;

const SYSTEM = `You help a woman in Michael Duivis's coaching program plan her go-to meals: the meals she eats every day.
She gives you a meal: either a description, or a list of ingredients (some fields may already be filled in).
Reply with JSON only, no words before or after:
{"name":"short meal name","items":[{"name":"Greek yogurt, 0% fat","qty":250,"unit":"g","brand":"Fage","store":"Costco","pkg_qty":1360,"pkg_price":7.49,"kcal":135,"protein":25,"fiber":0}]}
Rules:
- One item per ingredient, in the amount that goes into ONE serving of this meal.
- unit: g, ml, oz, fl oz, cup, tbsp, tsp, scoop or each. Use grams or ml for most foods; "each" for eggs, bananas, tortillas and so on.
- pkg_qty: the size of the package she would normally buy, in the SAME unit as qty (convert if needed: a 32 oz tub of yogurt in grams is 907; a dozen eggs is 12 each; a 2 lb protein tub in scoops is about 27 to 30).
- pkg_price: a typical current shelf price for that package at that store (or a normal grocery store if no store is given), in her currency, for her country. Round to cents.
- kcal, protein, fiber: for the amount in the meal (qty), not the package.
- Keep every value she already filled in exactly as she gave it; only fill in what's missing. Keep her ingredients in her order.
- If she named a brand or store, use it. If not, leave brand empty and suggest a common store for her country.
- Never add ingredients she didn't mention, except to split a recipe she named (e.g. "protein shake") into its parts.
- These are estimates; she will correct them.`;

/** November 26 (Michael): fill in a go-to meal's amounts, package sizes, prices and macros (she can edit everything). */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await req.json().catch(() => null) as { text?: string; name?: string; items?: GoItem[]; currency?: string; tz?: string } | null;
  if (!body) return NextResponse.json({ error: "Nothing to fill in." }, { status: 400 });
  const items = (body.items ?? []).filter((i) => i.name?.trim()).slice(0, 25);
  if (!items.length && !body.text?.trim()) return NextResponse.json({ error: "Add an ingredient or describe the meal first." }, { status: 400 });
  const where = body.tz ? `Her time zone is ${body.tz} (use it for her country and prices).` : "";
  const ask = [
    `Her currency: ${body.currency || "$"}. ${where}`,
    body.name ? `Meal name: ${body.name}` : "",
    body.text?.trim() ? `Her description: ${body.text.trim().slice(0, 1500)}` : "",
    items.length ? `Her ingredients so far (JSON; empty or null = fill it in):\n${JSON.stringify(items)}` : "",
  ].filter(Boolean).join("\n");
  try {
    let out: { name?: string; items?: GoItem[] };
    try { out = parseJson(await askClaude({ system: SYSTEM, content: [{ type: "text", text: ask }], maxTokens: 3000 })); }
    catch { out = parseJson(await askClaude({ system: SYSTEM, content: [{ type: "text", text: `${ask}\n\nReply with the JSON object only.` }], maxTokens: 3000 })); }
    const got = (out.items ?? []).slice(0, 25);
    // Whatever she typed wins; the AI only fills the blanks.
    const merged = (items.length ? items.map((mine, k) => {
      const ai = got.find((g) => g.name?.trim().toLowerCase() === mine.name.trim().toLowerCase()) ?? got[k] ?? ({} as GoItem);
      const pick = <K extends keyof GoItem>(f: K) => (mine[f] === null || mine[f] === undefined || mine[f] === "" ? ai[f] ?? mine[f] : mine[f]);
      return { name: mine.name, qty: pick("qty"), unit: pick("unit") ?? "", brand: pick("brand") ?? "", store: pick("store") ?? "", pkg_qty: pick("pkg_qty"), pkg_price: pick("pkg_price"), kcal: pick("kcal"), protein: pick("protein"), fiber: pick("fiber") } as GoItem;
    }) : got.map((g) => ({ name: g.name ?? "", qty: g.qty ?? null, unit: g.unit ?? "", brand: g.brand ?? "", store: g.store ?? "", pkg_qty: g.pkg_qty ?? null, pkg_price: g.pkg_price ?? null, kcal: g.kcal ?? null, protein: g.protein ?? null, fiber: g.fiber ?? null })));
    return NextResponse.json({ name: out.name ?? null, items: merged });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "The AI couldn't fill this in. Try again." }, { status: 500 });
  }
}
