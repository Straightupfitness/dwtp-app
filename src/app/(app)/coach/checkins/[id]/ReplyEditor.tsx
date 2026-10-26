"use client";
import { useState } from "react";
import VideoRecorder from "@/components/VideoRecorder";
import { saveReply } from "./actions";

type Summary = { win?: string; obstacle?: string; questions?: string; flags?: string[]; report?: { label: string; text: string }[] } | null;

const GOOD = /superfood|fruit|meat|vegetable|win/i, BAD = /processed|alcohol|low-|high-|fix/i;

export default function ReplyEditor({ checkinId, clientId, initialText, initialDraft, initialSummary, videoUrl, sentAt }: {
  checkinId: string; clientId: string; initialText: string; initialDraft: string; initialSummary: Summary;
  videoUrl: string | null; sentAt: string | null;
}) {
  const [text, setText] = useState(initialText || initialDraft);
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [video, setVideo] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "draft" | "save" | "send">("");
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(sentAt);

  async function draft() {
    if (text.trim() && !confirmReplace()) return;
    setBusy("draft"); setMsg("");
    const res = await fetch("/api/coach/draft", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ checkinId }) });
    const data = await res.json();
    setBusy("");
    if (!res.ok) { setMsg(data.error); return; }
    setText(data.draft); setSummary(data.summary);
  }
  // Inline confirmation instead of a browser dialog.
  const [askReplace, setAskReplace] = useState(false);
  function confirmReplace() { if (askReplace) { setAskReplace(false); return true; } setAskReplace(true); return false; }

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
      {!!summary?.report?.length && (
        <details open className="rounded-xl border border-border bg-card p-3 text-sm">
          <summary className="cursor-pointer text-xs uppercase tracking-widest text-accent">Food and weight report</summary>
          <dl className="mt-2 divide-y divide-border">
            {summary.report.map((r) => {
              const empty = /^(none|not logged)\.?$/i.test(r.text);
              return (
                <div key={r.label} className="grid grid-cols-[8.5rem_1fr] gap-2 py-1.5">
                  <dt className={`font-semibold ${empty ? "text-dim" : GOOD.test(r.label) ? "text-[#7ee2a8]" : BAD.test(r.label) ? "text-[#ff8a7e]" : "text-text"}`}>{r.label}</dt>
                  <dd className={empty ? "text-dim" : ""}>{r.text}</dd>
                </div>
              );
            })}
          </dl>
        </details>
      )}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm uppercase tracking-widest text-dim">Your reply</h2>
        <button type="button" onClick={draft} disabled={busy !== ""} className="min-h-11 rounded-lg border border-accent px-3 text-sm text-accent disabled:opacity-50">
          {busy === "draft" ? "Drafting… (about 20 sec)" : askReplace ? "Tap again to replace your text" : text ? "Redraft with AI" : "Draft with AI"}
        </button>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={16}
        placeholder="Tap Draft with AI, or write your reply. Use it as your script when you record your Loom."
        className="w-full rounded-xl border border-border bg-bg p-3 text-[15px] leading-relaxed outline-none focus:border-accent" />
      <p className="text-xs text-dim">{text.trim().split(/\s+/).filter(Boolean).length} words · about {Math.max(1, Math.round(text.trim().split(/\s+/).length / 150))} min spoken</p>

      <div className="space-y-2">
        <p className="text-sm">Add your video reply (optional)</p>
        {videoUrl && !video && <video src={videoUrl} controls playsInline className="w-full rounded-lg bg-black" />}
        <VideoRecorder folder={`${clientId}/replies`} onUploaded={setVideo} label={videoUrl ? "Record a new video" : "Record your reply"} />
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
