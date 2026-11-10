"use client";
import { useEffect, useState } from "react";
import { draftFeedback, feedbackFor, markTexted, sendFeedbackInChat, undoFeedback } from "@/app/(app)/coach/food/actions";

type Info = NonNullable<Awaited<ReturnType<typeof feedbackFor>>>;

function smsHref(phone: string, body: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return `sms:${/^\d{10}$/.test(digits) ? `+1${digits}` : digits}?&body=${encodeURIComponent(body)}`;
}

/**
 * November 10: Michael's food note right inside the day pop-up. Draft with AI (one win, one fix, a push for
 * tomorrow), edit, then text her or send it in the app. Only shown to the coach. Keyed by day, so it starts fresh each day.
 */
export default function FoodFeedbackBox({ clientId, day, hasFood }: { clientId: string; day: string; hasFood: boolean }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"" | "draft" | "send">("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState<Info["sentVia"]>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    feedbackFor(clientId, day).then((r) => { if (!live || !r) return; setInfo(r); setText(r.sentText ?? r.draft ?? ""); setSent(r.sentVia === "skipped" ? null : r.sentVia); });
    return () => { live = false; };
  }, [clientId, day]);

  if (!hasFood) return null;
  const draft = async () => {
    setBusy("draft"); setError("");
    const r = await draftFeedback(clientId, day);
    setBusy("");
    if (r.error) setError(r.error); else setText(r.text ?? "");
  };
  const done = (via: "chat" | "text") => async (p: Promise<{ error?: string } | { ok: boolean } | undefined>) => {
    const r = await p;
    setBusy("");
    if (r && "error" in r && r.error) setError(r.error); else setSent(via);
  };
  const btn = "min-h-10 rounded-lg px-3 text-[13px] font-semibold disabled:opacity-40";
  const has = !!text.trim();

  if (sent) return (
    <div className="space-y-1 rounded-[16px] border border-[#1f3a24] bg-[#0f1a11] p-3">
      <p className="flex items-center justify-between text-[12px] text-[#7ee2a8]"><span>✓ Food note {sent === "chat" ? "sent in the app" : "texted"}</span>
        <button type="button" onClick={async () => { await undoFeedback(clientId, day); setSent(null); }} className="text-dim underline">Write another</button></p>
      <p className="text-[13px] text-[#cfe9d5]">{text}</p>
    </div>
  );
  return (
    <div className="space-y-2 rounded-[16px] border border-[#3a3020] bg-[#161310] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.12em] text-accent">Your note to {info?.first ?? "her"}</p>
        <button type="button" onClick={draft} disabled={busy !== ""} className={`${btn} ${has ? "border border-[#3a3020] text-accent" : "bg-accent text-black"}`}>
          {busy === "draft" ? "Drafting…" : has ? "Redraft" : "✨ Draft with AI"}
        </button>
      </div>
      {(has || busy === "draft") && (
        <textarea value={busy === "draft" && !has ? "Drafting…" : text} onChange={(e) => setText(e.target.value)} rows={4} aria-label="Your food note"
          className="w-full rounded-xl border border-[#2a2a2a] bg-bg p-2.5 text-[14px] leading-snug outline-none focus:border-accent" />
      )}
      {error && <p className="text-[12px] text-[var(--red)]">{error}</p>}
      {has && (
        <div className="flex flex-wrap gap-1.5">
          {info?.phone && <a href={smsHref(info.phone, text)} onClick={() => { setBusy("send"); done("text")(markTexted(clientId, day, text)); }} className={`${btn} grid place-items-center bg-accent text-black`}>Text her</a>}
          <button type="button" disabled={busy !== ""} onClick={() => { setBusy("send"); done("chat")(sendFeedbackInChat(clientId, day, text)); }}
            className={`${btn} ${info?.phone ? "border border-accent text-accent" : "bg-accent text-black"}`}>{busy === "send" ? "Sending…" : "Send in app"}</button>
          <button type="button" onClick={async () => { await navigator.clipboard.writeText(text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className={`${btn} border border-[#2f2f2f]`}>{copied ? "Copied ✓" : "Copy"}</button>
        </div>
      )}
      {has && info && !info.phone && <p className="text-[11px] text-dim">No phone number on file. Add it on her page to text her.</p>}
    </div>
  );
}
