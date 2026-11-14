"use client";
import { useState } from "react";
import PrompterRecorder, { type PointGroup } from "./PrompterRecorder";
import { sendBlueprintReply } from "@/app/(app)/coach/followups/actions";

/**
 * November 13: Michael's video reply to her Driven Woman Blueprint. AI talking points from her answers, then he
 * records with them on screen (teleprompter) and it goes to her app chat with a line of text.
 */
export default function BlueprintReply({ clientId, first, initial = null, sentAt = null }: {
  clientId: string; first: string; initial?: { groups: PointGroup[]; at: string } | null; sentAt?: string | null;
}) {
  const [pts, setPts] = useState(initial);
  const [busy, setBusy] = useState<"" | "ai" | "send">("");
  const [err, setErr] = useState("");
  const [video, setVideo] = useState<string | null>(null);
  const [note, setNote] = useState(`Hi ${first}, here's a reply to `);
  const [sent, setSent] = useState(sentAt);

  async function draft() {
    setBusy("ai"); setErr("");
    const r = await fetch("/api/coach/blueprint-reply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId }) });
    const d = await r.json().catch(() => ({ error: "Something went wrong. Try again." }));
    setBusy("");
    if (!r.ok || d.error) { setErr(d.error ?? "Something went wrong."); return; }
    setPts(d);
  }
  async function send() {
    if (!video) return;
    setBusy("send"); setErr("");
    const r = await sendBlueprintReply(clientId, video, note);
    setBusy("");
    if (r?.error) { setErr(r.error); return; }
    setSent(new Date().toISOString()); setVideo(null);
  }

  return (
    <div className="space-y-2.5 rounded-xl border border-[#3a3020] bg-[#15120c] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm uppercase tracking-widest text-accent">Your Blueprint reply</p>
        <button type="button" onClick={draft} disabled={busy !== ""} className="min-h-10 rounded-lg border border-accent px-3 text-[13px] text-accent disabled:opacity-50">
          {busy === "ai" ? "Thinking… (about 20 sec)" : pts ? "Redo with AI" : "Talking points with AI"}
        </button>
      </div>
      <a href={`/coach/clients/${clientId}#blueprint`} className="block text-[13px] text-accent underline">See her exact answers and her videos</a>
      {sent && <p className="text-[13px] text-[#7ddc8f]">✓ Sent to her chat {new Date(sent).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}. Record another below if you want.</p>}
      {pts ? (
        <div className="space-y-2 text-[14px] leading-snug">
          {pts.groups.map((g, i) => (
            <div key={i}>
              {g.h && <p className="text-[12px] font-semibold uppercase tracking-[0.08em]">{g.h}</p>}
              <ul className="mt-0.5 space-y-0.5">{g.items.map((x, j) => <li key={j} className="flex gap-2"><span className="text-dim">•</span><span>{x}</span></li>)}</ul>
            </div>
          ))}
        </div>
      ) : <p className="text-[13px] text-dim">Get talking points from her answers, then record your video with them on screen.</p>}
      <PrompterRecorder points={pts?.groups ?? []} bucket="media" folder={`chat/${clientId}`} onUploaded={setVideo} uploadLabel="Use this video" />
      {video && (
        <div className="space-y-2">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} aria-label="A line of text with your video"
            className="w-full rounded-xl border border-[#2a2a2a] bg-bg p-3 text-[15px] outline-none focus:border-accent" />
          <button type="button" onClick={send} disabled={busy !== ""} className="min-h-12 w-full rounded-xl bg-accent font-semibold text-black disabled:opacity-50">
            {busy === "send" ? "Sending…" : `Send to ${first}'s chat`}
          </button>
        </div>
      )}
      {err && <p className="text-sm text-[var(--red)]">{err}</p>}
    </div>
  );
}
