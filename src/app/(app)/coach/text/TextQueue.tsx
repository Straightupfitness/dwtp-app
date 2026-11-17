"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export type TextRow = { id: string; name: string; first: string; last: string; phone: string | null; week?: number; weight?: number | null; goal?: number | null; city?: string | null; time?: string | null };

const CLIENT_FIELDS: [string, string][] = [["{first}", "First name"], ["{last}", "Last name"], ["{week}", "Program week"], ["{weight}", "Latest weight"], ["{goal}", "Goal weight"], ["{togo}", "Lbs to goal"]];
const LEAD_FIELDS: [string, string][] = [["{first}", "First name"], ["{last}", "Last name"], ["{city}", "City"], ["{time}", "Time slot"]];
const SENT_KEY = "dwtp-text-sent";
const fmt = (n: number | null | undefined) => (n === undefined ? "" :  n === null ? "" : String(Math.round(n * 10) / 10));

export function fill(t: string, r: TextRow) {
  const togo = r.weight != null && r.goal != null ? Math.max(0, Math.round((r.weight - r.goal) * 10) / 10) : null;
  return t
    .replace(/\{\s*first\s*(name)?\s*\}|\[\s*first\s*name\s*\]|\bfirst_?name\b/gi, r.first)
    .replace(/\{\s*last\s*(name)?\s*\}/gi, r.last)
    .replace(/\{\s*week\s*\}/gi, (r.week ?? 0) >= 1 ? String(r.week) : "1")
    .replace(/\{\s*city\s*\}/gi, r.city ?? "")
    .replace(/\{\s*time\s*\}/gi, r.time ?? "")
    .replace(/\{\s*weight\s*\}/gi, fmt(r.weight))
    .replace(/\{\s*goal\s*\}/gi, fmt(r.goal))
    .replace(/\{\s*togo\s*\}/gi, fmt(togo));
}
const smsHref = (phone: string, body: string) => {
  const d = phone.replace(/[^\d+]/g, "");
  return `sms:${/^\d{10}$/.test(d) ? `+1${d}` : d}?&body=${encodeURIComponent(body)}`;
};

/**
 * November 15: the Hit 'Em Up flow. Write once with fill-ins, then tap each name: Messages opens with her text ready,
 * he taps send, swipes back, and the next one is highlighted. Progress is kept on this phone (the app may reload
 * while he's in Messages).
 */
export default function TextQueue({ rows, kind = "clients" }: { rows: TextRow[]; kind?: "clients" | "leads" }) {
  const FIELDS = kind === "leads" ? LEAD_FIELDS : CLIENT_FIELDS;
  const TPL_KEY = `dwtp-text-template${kind === "leads" ? "-leads" : ""}`;
  const [tpl, setTpl] = useState("Hi {first}, ");
  const [sent, setSent] = useState<Record<string, number>>({});
  const [step, setStep] = useState<"write" | "send">("write");
  const key = useMemo(() => rows.map((r) => r.id).sort().join(","), [rows]);

  useEffect(() => {
    try {
      const t = localStorage.getItem(TPL_KEY);
      const s = JSON.parse(localStorage.getItem(SENT_KEY) ?? "{}") as { key?: string; tpl?: string; sent?: Record<string, number> };
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring this phone's saved draft and progress once
      if (t) setTpl(t);
      if (s.key === key && s.sent && Object.keys(s.sent).length) { setSent(s.sent); setStep("send"); if (s.tpl) setTpl(s.tpl); }
    } catch {}
  }, [key, TPL_KEY]);
  const save = (next: Record<string, number>) => { setSent(next); try { localStorage.setItem(SENT_KEY, JSON.stringify({ key, tpl, sent: next })); } catch {} };

  const withPhone = rows.filter((r) => r.phone), noPhone = rows.filter((r) => !r.phone);
  const nextId = withPhone.find((r) => !sent[r.id])?.id;
  const done = withPhone.filter((r) => sent[r.id]).length;

  if (step === "write") return (
    <div className="space-y-3">
      <p className="text-[14px] text-[#a8a8a8]">Write your message once. The fill-ins become each client&apos;s own details.</p>
      <textarea value={tpl} onChange={(e) => setTpl(e.target.value)} rows={6} autoFocus aria-label="Your text"
        className="w-full rounded-xl border border-border bg-card p-3 text-base outline-none focus:border-accent" />
      <div className="flex flex-wrap gap-1.5">
        {FIELDS.map(([f, l]) => <button key={f} type="button" onClick={() => setTpl((t) => t + f)} className="min-h-9 rounded-full border border-border px-3 text-[13px]">+ {l}</button>)}
      </div>
      {rows[0] && tpl.trim() && (
        <div className="rounded-xl border border-border bg-card p-3 text-[14px]">
          <p className="mb-1 text-[11px] uppercase tracking-[0.1em] text-dim">What {rows[0].first} gets</p>
          <p className="whitespace-pre-line">{fill(tpl, rows[0])}</p>
        </div>
      )}
      {noPhone.length > 0 && <p className="text-[13px] text-[#e7d3a8]">No phone number for {noPhone.map((r) => r.first).join(", ")}, so they&apos;re skipped. Add one on her {kind === "leads" ? "lead" : "client page"}.</p>}
      <button type="button" disabled={!tpl.trim() || !withPhone.length} onClick={() => { try { localStorage.setItem(TPL_KEY, tpl); } catch {} save({}); setStep("send"); }}
        className="min-h-12 w-full rounded-xl bg-accent font-semibold text-black disabled:opacity-50">Next: send to {withPhone.length} →</button>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[14px]"><b>{done}</b> of {withPhone.length} sent</p>
        <button type="button" onClick={() => setStep("write")} className="min-h-10 px-2 text-[13px] text-accent underline">Edit message</button>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#222]"><div className="h-full bg-accent transition-all" style={{ width: `${(done / Math.max(1, withPhone.length)) * 100}%` }} /></div>
      <p className="text-[13px] text-dim">Tap a name: Messages opens with her text ready. Tap send, swipe back here, and tap the next one.</p>
      <ul className="space-y-2">
        {withPhone.map((r) => {
          const body = fill(tpl, r), isNext = r.id === nextId, isSent = !!sent[r.id];
          return (
            <li key={r.id} className={`rounded-2xl border p-3 ${isNext ? "border-accent bg-[#161310]" : "border-border bg-card"} ${isSent ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-semibold">{isSent ? "✓ " : ""}{r.name}</span>
                  <span className="block truncate text-[12px] text-dim">{body.replace(/\s+/g, " ").slice(0, 90)}</span></span>
                <a href={smsHref(r.phone!, body)} onClick={() => save({ ...sent, [r.id]: Date.now() })}
                  className={`flex min-h-11 shrink-0 items-center rounded-xl px-3.5 text-[14px] font-semibold ${isNext ? "bg-accent text-black" : "border border-border"}`}>
                  {isSent ? "Again" : `📱 Text ${r.first}`}
                </a>
              </div>
            </li>
          );
        })}
      </ul>
      {done === withPhone.length && <p className="rounded-xl border border-[#2f5d3a] p-3 text-center text-[14px] text-[#7ddc8f]">All {done} texted 🎉</p>}
      {noPhone.length > 0 && (
        <p className="text-[13px] text-dim">No phone number: {noPhone.map((r, i) => <span key={r.id}>{i ? ", " : ""}{kind === "leads" ? r.first : <Link href={`/coach/clients/${r.id}`} className="underline">{r.first}</Link>}</span>)}</p>
      )}
    </div>
  );
}
