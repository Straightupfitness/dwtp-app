"use client";
import { useState } from "react";
import PrompterRecorder, { groupsFromText } from "@/components/PrompterRecorder";
import { saveReply } from "./actions";

type Summary = { win?: string; obstacle?: string; questions?: string; flags?: string[]; report?: { label: string; text: string }[] } | null;

const TONE: [RegExp, string][] = [[/worst/i, "text-[#ff8a7e]"], [/nutrient|best/i, "text-[#7ee2a8]"], [/fruit|next/i, "text-accent"]];

/** "## Heading" lines and "- bullet" lines, as a compact list. */
function Points({ text }: { text: string }) {
  const blocks: { h: string; items: string[] }[] = [];
  for (const raw of text.split("\n")) {
    const l = raw.trim();
    if (!l) continue;
    const h = l.match(/^#{1,4}\s*(.+)$/) ?? l.match(/^\*\*(.+)\*\*:?$/);
    if (h) { blocks.push({ h: h[1].replace(/:$/, ""), items: [] }); continue; }
    if (!blocks.length) blocks.push({ h: "", items: [] });
    blocks[blocks.length - 1].items.push(l.replace(/^[-*•]\s*/, ""));
  }
  return (
    <div className="space-y-2.5 text-[14px] leading-snug">
      {blocks.map((b, i) => (
        <div key={i}>
          {b.h && <p className={`text-[12px] font-semibold uppercase tracking-[0.08em] ${TONE.find(([r]) => r.test(b.h))?.[1] ?? "text-text"}`}>{b.h}</p>}
          <ul className="mt-1 space-y-1">{b.items.map((x, j) => <li key={j} className="flex gap-2"><span className="text-dim">•</span><span>{x}</span></li>)}</ul>
        </div>
      ))}
    </div>
  );
}

export default function ReplyEditor({ checkinId, clientId, initialText, initialDraft, initialSummary, videoUrl, sentAt }: {
  checkinId: string; clientId: string; initialText: string; initialDraft: string; initialSummary: Summary;
  videoUrl: string | null; sentAt: string | null;
}) {
  const [text, setText] = useState(initialText);
  const [points, setPoints] = useState(initialDraft);
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [video, setVideo] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "draft" | "save" | "send">("");
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(sentAt);

  async function draft() {
    setBusy("draft"); setMsg("");
    const res = await fetch("/api/coach/draft", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ checkinId }) });
    const data = await res.json();
    setBusy("");
    if (!res.ok) { setMsg(data.error); return; }
    setPoints(data.draft); setSummary(data.summary);
  }

  async function save(send: boolean) {
    setBusy(send ? "send" : "save"); setMsg("");
    const r = await saveReply(checkinId, text, video, send);
    setBusy("");
    if (r?.error) setMsg(r.error);
    else { setMsg(send ? "Sent. She'll see it on her Check-in tab." : "Saved."); if (send) setSent(new Date().toISOString()); }
  }

  return (
    <div className="space-y-3">
      {summary && (
        <div className="space-y-1 rounded-xl border border-border bg-card p-3 text-sm">
          {summary.win && <p><b className="text-gold">Win:</b> {summary.win}</p>}
          {summary.obstacle && <p><b className="text-gold">Obstacle:</b> {summary.obstacle}</p>}
          {summary.questions && <p><b className="text-gold">Her questions:</b> {summary.questions}</p>}
          {!!summary.flags?.length && <p><b className="text-gold">Flags:</b> {summary.flags.join(" · ")}</p>}
        </div>
      )}
      {/* November 1: talking points in bullets (his own words do the rest). */}
      <div className="space-y-2 rounded-xl border border-[#3a3020] bg-[#15120c] p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm uppercase tracking-widest text-accent">Talking points</h2>
          <button type="button" onClick={draft} disabled={busy !== ""} className="min-h-10 rounded-lg border border-accent px-3 text-[13px] text-accent disabled:opacity-50">
            {busy === "draft" ? "Thinking… (about 30 sec)" : points ? "Redo with AI" : "Draft with AI"}
          </button>
        </div>
        {points ? <Points text={points} /> : <p className="text-[13px] text-dim">Tap Draft with AI for bullet points: her questions and concerns, worst foods, most nutrient-dense foods, her weigh-ins and her lowest-hanging fruit.</p>}
      </div>
      <h2 className="text-sm uppercase tracking-widest text-dim">Your reply</h2>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8}
        placeholder="Record a video below, or type a reply. She sees this text with your video."
        className="w-full rounded-xl border border-border bg-bg p-3 text-[15px] leading-relaxed outline-none focus:border-accent" />
      <p className="text-xs text-dim">{text.trim().split(/\s+/).filter(Boolean).length} words · about {Math.max(1, Math.round(text.trim().split(/\s+/).length / 150))} min spoken</p>

      <div className="space-y-2">
        <p className="text-sm">Your video reply</p>
        {videoUrl && !video && <video src={videoUrl} controls playsInline className="w-full rounded-lg bg-black" />}
        {/* November 13: record with the talking points on screen, like a teleprompter. */}
        <PrompterRecorder points={groupsFromText(points)} bucket="checkin-videos" folder={`${clientId}/replies`} onUploaded={setVideo}
          label={videoUrl ? "🎥 Record a new video (talking points on screen)" : "🎥 Record with your talking points"} />
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => save(false)} disabled={busy !== ""} className="min-h-12 flex-1 rounded-xl border border-border">{busy === "save" ? "Saving…" : "Save draft"}</button>
        <button type="button" onClick={() => save(true)} disabled={busy !== ""} className="min-h-12 flex-1 rounded-xl bg-accent font-semibold text-black disabled:opacity-50">
          {busy === "send" ? "Sending…" : sent ? "Update sent reply" : "Send to her"}
        </button>
      </div>
      {msg && <p className="text-sm">{msg}</p>}
      {sent && <p className="text-xs text-dim">Sent {new Date(sent).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} Pacific</p>}
    </div>
  );
}
