"use client";
import { useState } from "react";
import Link from "next/link";
import type { Brief } from "@/lib/ai/client-brief";
import { markFollowup } from "@/app/(app)/coach/followups/actions";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });

/**
 * November 13: "What's she been up to?" The AI reads her last 48 hours (or 7 days) and gives Michael two short lists:
 * what she's been doing, and the flow for his message. Bullets only; he writes it in his own words, in the app and by text.
 */
export default function BriefPanel({ clientId, first, phone, topic, initial = null, doneAt = null, compact = false }: {
  clientId: string; first: string; phone: string | null; topic?: string; initial?: Brief | null; doneAt?: string | null; compact?: boolean;
}) {
  const [brief, setBrief] = useState<Brief | null>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(!!doneAt);
  const [hours, setHours] = useState(initial?.hours ?? 48);

  async function run(h = hours) {
    setBusy(true); setErr("");
    const r = await fetch("/api/coach/brief", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId, topic, hours: h }) });
    const data = await r.json().catch(() => ({ error: "Something went wrong. Try again." }));
    setBusy(false);
    if (!r.ok || data.error) { setErr(data.error ?? "Something went wrong. Try again."); return; }
    setBrief(data);
  }
  async function toggleDone() {
    if (!topic) return;
    const next = !done;
    setDone(next);
    const r = await markFollowup(clientId, topic, next);
    if (r?.error) { setDone(!next); setErr(r.error); }
  }
  const sms = phone ? `sms:${phone.replace(/[^\d+]/g, "")}` : null;

  return (
    <div className={`space-y-2.5 ${compact ? "" : "rounded-2xl border border-border bg-card p-3.5"}`}>
      {!compact && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-[0.15em] text-accent">What&apos;s she been up to?</p>
          <div className="flex rounded-lg border border-[#2a2a2a] text-[12px]">
            {[48, 168].map((h) => <button key={h} type="button" onClick={() => { setHours(h); if (brief) run(h); }} className={`min-h-8 px-2.5 ${hours === h ? "bg-[#2a2a2a] text-text" : "text-dim"}`}>{h === 48 ? "48 hours" : "7 days"}</button>)}
          </div>
        </div>
      )}
      {!brief && (
        <button type="button" onClick={() => run()} disabled={busy} className="min-h-11 w-full rounded-xl border border-accent text-[14px] font-semibold text-accent disabled:opacity-60">
          {busy ? "Reading her last 48 hours… (about 15 sec)" : `✨ What has ${first} been doing? (last ${hours === 48 ? "48 hours" : "7 days"})`}
        </button>
      )}
      {brief && (
        <div className="space-y-2.5">
          {brief.status && <p className="text-[13px] font-semibold">{brief.status}</p>}
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-dim">What she&apos;s been doing</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[14px] leading-snug text-[#d6d6d6]">{brief.doing.map((d, i) => <li key={i}>{d}</li>)}</ul>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-accent">Your message, in this order</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-[14px] leading-snug">{brief.points.map((d, i) => <li key={i}>{d}</li>)}</ol>
          </div>
          <p className="text-[11px] text-dim">Read {when(brief.at)} · <button type="button" onClick={() => run()} disabled={busy} className="underline">{busy ? "Reading…" : "Redo"}</button></p>
        </div>
      )}
      {err && <p className="text-sm text-[var(--red)]">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <Link href={`/coach/inbox/${clientId}`} className="flex min-h-10 flex-1 items-center justify-center rounded-xl border border-border text-[13px] font-semibold">💬 Message in app</Link>
        {sms
          ? <a href={sms} className="flex min-h-10 flex-1 items-center justify-center rounded-xl border border-border text-[13px] font-semibold">📱 Text {first}</a>
          : <span className="flex min-h-10 flex-1 items-center justify-center rounded-xl border border-dashed border-[#2a2a2a] text-[12px] text-dim">No phone number</span>}
        {topic && (
          <button type="button" onClick={toggleDone} className={`min-h-10 flex-1 rounded-xl text-[13px] font-semibold ${done ? "border border-[#2f5d3a] text-[#7ddc8f]" : "bg-accent text-black"}`}>{done ? "✓ Sent · undo" : "Mark sent ✓"}</button>
        )}
      </div>
    </div>
  );
}
