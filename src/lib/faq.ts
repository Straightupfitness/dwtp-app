export type FaqLink = { label: string; note?: string | null; url?: string | null };
export type FaqItem = { id: string; section_id: string; kind: "qa" | "list"; title: string; body: string | null; video_url: string | null; links: FaqLink[]; sort: number };
export type FaqSection = { id: string; slug: string | null; title: string; intro: string | null; sort: number; items: FaqItem[] };

/** "Label | note | https://…" per line ↔ links. */
export function linksToText(links: FaqLink[]) {
  return links.map((l) => [l.label, l.note ?? "", l.url ?? ""].join(" | ").replace(/( \| )+$/, "")).join("\n");
}
export function textToLinks(text: string): FaqLink[] {
  return text.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const parts = line.split("|").map((p) => p.trim());
    const url = parts.find((p) => /^https?:\/\//i.test(p)) ?? "";
    const rest = parts.filter((p) => p !== url);
    return { label: rest[0] ?? "", note: rest[1] || null, url: url || null };
  }).filter((l) => l.label);
}
