"use client";
import { useState } from "react";
import Link from "next/link";
import type { Brief } from "@/lib/ai/client-brief";
import { markFollowup, sendInApp } from "@/app/(app)/coach/followups/actions";

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
  // November 13: write it once; send it in the app, and text it from his own phone (Messages opens with it typed in).
  const [msg, setMsg] = useState(`Hey ${first}, `);
  const [sentApp, setSentApp] = useState(false);
  const [sending, setSending] = useState(false);

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
  const digits = phone ? phone.replace(/[^\d+]/g, "") : "";
  const num = /^\d{10}$/.test(digits) ? `+1${digits}` : digits;
  const typed = msg.trim() && msg.trim() !== `Hey ${first},`;
  const sms = num ? `sms:${num}?&body=${encodeURIComponent(typed ? msg.trim() : "")}` : null;
  async function inApp() {
    setSending(true); setErr("");
    const r = await sendInApp(clientId, msg);
    setSending(false);
    if (r?.error) setErr(r.error); else setSentApp(true);
  }

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
      <div className="space-y-2">
        <textarea value={msg} onChange={(e) => { setMsg(e.target.value); setSentApp(false); }} rows={4} aria-label={`Your message to ${first}`}
          placeholder={`Write it your way, then send it in the app and text it to ${first}.`}
          className="w-full rounded-xl border border-[#2a2a2a] bg-bg p-3 text-[15px] leading-relaxed outline-none focus:border-accent" />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={inApp} disabled={!typed || sending || sentApp}
            className={`flex min-h-11 flex-1 items-center justify-center rounded-xl border text-[13px] font-semibold disabled:opacity-60 ${sentApp ? "border-[#2f5d3a] text-[#7ddc8f]" : "border-border"}`}>
            {sentApp ? "✓ Sent in app" : sending ? "Sending…" : "💬 Send in app"}
          </button>
          {sms
            ? <a href={sms} className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-border text-[13px] font-semibold">📱 Text {first}</a>
            : <span className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-dashed border-[#2a2a2a] text-[12px] text-dim">No phone number on file</span>}
          {topic && (
            <button type="button" onClick={toggleDone} className={`min-h-11 flex-1 rounded-xl text-[13px] font-semibold ${done ? "border border-[#2f5d3a] text-[#7ddc8f]" : "bg-accent text-black"}`}>{done ? "✓ Sent · undo" : "Mark sent ✓"}</button>
          )}
        </div>
        <p className="text-[11px] text-dim">📱 opens Messages on your phone with this typed in, from your own number. <Link href={`/coach/inbox/${clientId}`} className="underline">Open her chat</Link></p>
      </div>
    </div>
  );
}
