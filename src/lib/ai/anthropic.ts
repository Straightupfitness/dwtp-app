/** Minimal Anthropic Messages API client (server only). */
const API = "https://api.anthropic.com/v1/messages";

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

export async function askClaude(opts: {
  system: string;
  content: ContentBlock[];
  maxTokens?: number;
  model?: string;
}): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set in Vercel.");
  const call = async (maxTokens: number) => {
    const res = await fetch(API, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: opts.model ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
        max_tokens: maxTokens,
        system: opts.system,
        messages: [{ role: "user", content: opts.content }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { content: { type: string; text?: string }[]; stop_reason?: string };
    return { text: data.content.filter((b) => b.type === "text").map((b) => b.text).join(""), stop: data.stop_reason ?? "" };
  };
  // A reply can come back with no words when the model spends its whole budget thinking first (October 31: the
  // check-in drafts). Then ask again with plenty of room.
  const first = opts.maxTokens ?? 1500;
  let r = await call(first);
  // November 13 (Patricia's Blueprint points stopped mid-sentence): an answer cut off at the length limit is
  // incomplete, so ask again with plenty of room instead of showing half of it.
  if ((!r.text.trim() || r.stop === "max_tokens") && r.stop !== "refusal") r = await call(Math.max(first * 4, 12000));
  if (r.stop === "max_tokens") throw new Error("The AI's answer was cut off. Try again.");
  if (!r.text.trim()) throw new Error(r.stop === "refusal" ? "The AI declined to write this one. Write it by hand." : `The AI returned no text (${r.stop || "no reason given"}).`);
  return r.text;
}

/** Pull the first JSON object out of a model reply. */
export function parseJson<T>(text: string): T {
  // November 20: the first complete {...} in the reply (a note or a second object after it no longer breaks it), with
  // small slips forgiven (trailing commas, fractions like 1/2 as numbers).
  const objects: string[] = [];
  for (let i = text.indexOf("{"); i >= 0 && objects.length < 5; i = text.indexOf("{", i + 1)) {
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}" && --depth === 0) { objects.push(text.slice(i, j + 1)); i = j; break; }
    }
  }
  if (!objects.length) throw new Error("No JSON in AI reply");
  const fix = (s: string) => s.replace(/,\s*([}\]])/g, "$1").replace(/:\s*(\d+)\/(\d+)\s*([,}])/g, (_m, a, b, c) => `: ${(Number(a) / Number(b)).toFixed(2)}${c}`);
  for (const o of objects) {
    try { return JSON.parse(o) as T; } catch {}
    try { return JSON.parse(fix(o)) as T; } catch {}
  }
  throw new Error("No JSON in AI reply");
}
