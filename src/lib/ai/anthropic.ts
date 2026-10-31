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
  if (!r.text.trim() && r.stop !== "refusal") r = await call(Math.max(first * 4, 12000));
  if (!r.text.trim()) throw new Error(r.stop === "refusal" ? "The AI declined to write this one. Write it by hand." : `The AI returned no text (${r.stop || "no reason given"}).`);
  return r.text;
}

/** Pull the first JSON object out of a model reply. */
export function parseJson<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("No JSON in AI reply");
  return JSON.parse(text.slice(start, end + 1)) as T;
}
