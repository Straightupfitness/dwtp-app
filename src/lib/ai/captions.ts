import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { videoPublicUrl } from "../videos";

type Word = { word: string; punctuated_word?: string; start: number; end: number };

const t = (s: number) => {
  const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), sec = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
};

/** Words → short caption lines: up to ~40 characters or ~3.5 seconds, breaking at the end of a sentence or a pause. */
export function toVtt(words: Word[]): string {
  const cues: { a: number; b: number; text: string }[] = [];
  let cur: Word[] = [];
  const flush = () => { if (cur.length) cues.push({ a: cur[0].start, b: cur[cur.length - 1].end, text: cur.map((w) => w.punctuated_word ?? w.word).join(" ") }); cur = []; };
  for (let i = 0; i < words.length; i++) {
    const w = words[i], next = words[i + 1];
    cur.push(w);
    const text = cur.map((x) => x.punctuated_word ?? x.word).join(" ");
    const end = /[.!?]$/.test(w.punctuated_word ?? "");
    const comma = /[,;:]$/.test(w.punctuated_word ?? "");
    const pause = next ? next.start - w.end > 0.6 : true;
    if (end || pause || text.length >= 40 || (comma && text.length >= 24) || w.end - cur[0].start >= 3.5) flush();
  }
  flush();
  return "WEBVTT\n\n" + cues.map((c, i) => `${i + 1}\n${t(c.a)} --> ${t(Math.max(c.b, c.a + 0.8))}\n${c.text}`).join("\n\n") + "\n";
}

/** Makes (or remakes) the captions for one program video. Returns the number of caption lines, or an error. */
export async function makeCaptions(db: SupabaseClient, code: string): Promise<{ lines?: number; error?: string }> {
  const key = process.env.DEEPGRAM_API_KEY?.trim();
  if (!key) return { error: "DEEPGRAM_API_KEY is missing in Vercel." };
  const { data: v, error } = await db.from("program_videos").select("path, uploaded_at").eq("code", code).maybeSingle();
  if (error) return { error: /captions/.test(error.message) ? "Run SQL 40 (video captions) first." : error.message };
  if (!v?.path) return { error: `${code} isn't uploaded.` };
  const terms = ["DWTP", "Driven", "NSDR", "ATG", "Poliquin", "tibialis", "Eisenhower", "No-Nap Nap", "Blinking Method", "Capacity Circles", "Kinobody", "moringa", "ashwagandha"];
  const qs = new URLSearchParams({ model: "nova-3", smart_format: "true", language: "en" });
  for (const k of terms) qs.append("keyterm", k);
  try {
    const res = await fetch(`https://api.deepgram.com/v1/listen?${qs}`, {
      method: "POST", headers: { Authorization: `Token ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ url: videoPublicUrl(v.path as string) }),
    });
    if (!res.ok) return { error: `Deepgram ${res.status}: ${(await res.text()).slice(0, 160)}` };
    const data = await res.json();
    const words: Word[] = data?.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];
    const vtt = words.length ? toVtt(words) : "";
    const { error: up } = await db.from("program_videos").update({ captions: vtt || null, captions_at: new Date().toISOString() }).eq("code", code);
    if (up) return { error: up.message };
    return { lines: vtt ? vtt.split("\n\n").length - 1 : 0 };
  } catch (e) { return { error: String(e).slice(0, 160) }; }
}
