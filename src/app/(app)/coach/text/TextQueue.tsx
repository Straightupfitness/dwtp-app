"use client";
import { markReachedOut } from "../leads/actions";
import { markClientTexted } from "./actions";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export type TextRow = { id: string; name: string; first: string; last: string; phone: string | null; handle?: string | null; week?: number; weight?: number | null; goal?: number | null; city?: string | null; time?: string | null };

const CLIENT_FIELDS: [string, string][] = [["{first}", "First name"], ["{last}", "Last name"], ["{week}", "Program week"], ["{weight}", "Latest weight"], ["{goal}", "Goal weight"], ["{togo}", "Lbs to goal"]];
const LEAD_FIELDS: [string, string][] = [["{first}", "First name"], ["{last}", "Last name"], ["{city}", "City"], ["{time}", "Time slot"]];
const SENT_KEY = "dwtp-text-sent";
const fmt = (n: number | null | undefined) => (n === undefined ? "" :  n === null ? "" : String(Math.round(n * 10) / 10));

export const smsLink = (phone: string, body: string) => smsHref(phone, body);
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
/** November 20: Facebook Messenger (his personal Facebook) and Instagram DMs (SUFitness). They open her chat on a phone
 * or a computer; the message is copied first, so he pastes it and taps send. */
export type Via = "sms" | "messenger" | "instagram";
const VIA = {
  sms: { verb: "Text", icon: "📱", app: "Messages", none: "No phone number" },
  messenger: { verb: "Message", icon: "💬", app: "Messenger", none: "No Facebook" },
  instagram: { verb: "DM", icon: "📸", app: "Instagram", none: "No Instagram" },
} as const;
const chatHref = (via: Via, to: string, body: string) => via === "messenger" ? `https://m.me/${encodeURIComponent(to)}`
  : via === "instagram" ? `https://ig.me/m/${encodeURIComponent(to)}` : smsHref(to, body);
const smsHref = (phone: string, body: string) => {
  const d = phone.replace(/[^\d+]/g, "");
  return `sms:${/^\d{10}$/.test(d) ? `+1${d}` : d}?&body=${encodeURIComponent(body)}`;
};

/**
 * November 15: the Hit 'Em Up flow. Write once with fill-ins, then tap each name: Messages opens with her text ready,
 * he taps send, swipes back, and the next one is highlighted. Progress is kept on this phone (the app may reload
 * while he's in Messages).
 */
export default function TextQueue({ rows: all, kind = "clients", via = "sms" }: { rows: TextRow[]; kind?: "clients" | "leads"; via?: Via }) {
  const V = VIA[via];
  const addr = (r: TextRow) => (via === "sms" ? r.phone : r.handle ?? null);
  const [copied, setCopied] = useState<string | null>(null);
  const FIELDS = kind === "leads" ? LEAD_FIELDS : CLIENT_FIELDS;
  const TPL_KEY = `dwtp-text-template${kind === "leads" ? "-leads" : ""}`;
  const [tpl, setTpl] = useState("Hi {first}, ");
  const [sent, setSent] = useState<Record<string, number>>({});
  const [step, setStep] = useState<"write" | "send">("write");
  // November 26 (Michael): ✕ takes someone off this batch (picked by mistake, or he changed his mind).
  const [gone, setGone] = useState<string[]>([]);
  const key = useMemo(() => all.map((r) => r.id).sort().join(","), [all]);
  const rows = all.filter((r) => !gone.includes(r.id));

  useEffect(() => {
    try {
      const t = localStorage.getItem(TPL_KEY);
      const s = JSON.parse(localStorage.getItem(SENT_KEY) ?? "{}") as { key?: string; tpl?: string; sent?: Record<string, number> };
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring this phone's saved draft and progress once
      if (t) setTpl(t);
      if (s.key === key && s.sent && Object.keys(s.sent).length) { setSent(s.sent); setStep("send"); if (s.tpl) setTpl(s.tpl); }
      if (s.key === key && Array.isArray((s as { gone?: string[] }).gone)) setGone((s as { gone?: string[] }).gone!);
    } catch {}
  }, [key, TPL_KEY]);
  const save = (next: Record<string, number>, g = gone) => { setSent(next); try { localStorage.setItem(SENT_KEY, JSON.stringify({ key, tpl, sent: next, gone: g })); } catch {} };
  const remove = (id: string) => { const g = [...gone, id]; setGone(g); save(sent, g); };
  const X = ({ r }: { r: TextRow }) => (
    <button type="button" onClick={() => remove(r.id)} aria-label={`Don't send to ${r.first}`} title={`Don't send to ${r.first}`}
      className="grid size-9 shrink-0 place-items-center rounded-full text-[18px] text-dim hover:bg-[#2a1515] hover:text-[#ff9a9a]">✕</button>
  );

  const withPhone = rows.filter((r) => addr(r)), noPhone = rows.filter((r) => !addr(r));
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
      <div className="flex flex-wrap gap-1.5" aria-label="Sending to">
        {rows.map((r) => (
          <span key={r.id} className="flex items-center gap-0.5 rounded-full border border-border bg-card pl-3 text-[13px]">{r.name}<X r={r} /></span>
        ))}
        {gone.length > 0 && <button type="button" onClick={() => { setGone([]); save(sent, []); }} className="min-h-9 px-2 text-[13px] text-accent underline">Undo ({gone.length} removed)</button>}
      </div>
      {noPhone.length > 0 && <p className="text-[13px] text-[#e7d3a8]">{V.none} for {noPhone.map((r) => r.first).join(", ")}, so they&apos;re skipped. Add it on her {kind === "leads" ? "lead (Details)" : "client page"}.</p>}
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
      <p className="text-[13px] text-dim">{via === "sms" ? "Tap a name: Messages opens with her text ready. Tap send, swipe back here, and tap the next one."
        : `Tap a name: your message is copied and her ${V.app} chat opens (on your phone or computer). Paste, tap send, come back here, and tap the next one.${via === "instagram" ? " Make sure you're on the SUFitness account in Instagram." : ""}`}</p>
      <ul className="space-y-2">
        {withPhone.map((r) => {
          const body = fill(tpl, r), isNext = r.id === nextId, isSent = !!sent[r.id];
          return (
            <li key={r.id} className={`rounded-2xl border p-3 ${isNext ? "border-accent bg-[#161310]" : "border-border bg-card"} ${isSent ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-semibold">{isSent ? "✓ " : ""}{r.name}</span>
                  <span className="block truncate text-[12px] text-dim">{copied === r.id ? "Copied. Paste it in the chat." : body.replace(/\s+/g, " ").slice(0, 90)}</span></span>
                <a href={chatHref(via, addr(r)!, body)} target={via === "sms" ? undefined : "_blank"} rel="noopener noreferrer"
                  onClick={() => {
                    if (via !== "sms") { void navigator.clipboard?.writeText(body).then(() => setCopied(r.id)).catch(() => {}); }
                    save({ ...sent, [r.id]: Date.now() }); if (kind === "leads") void markReachedOut(r.id).catch(() => {}); else void markClientTexted(r.id).catch(() => {});
                  }}
                  className={`flex min-h-11 shrink-0 items-center rounded-xl px-3.5 text-[14px] font-semibold ${isNext ? "bg-accent text-black" : "border border-border"}`}>
                  {isSent ? "Again" : `${V.icon} ${V.verb} ${r.first}`}
                </a>
                {!isSent && <X r={r} />}
              </div>
            </li>
          );
        })}
      </ul>
      {done === withPhone.length && <p className="rounded-xl border border-[#2f5d3a] p-3 text-center text-[14px] text-[#7ddc8f]">All {done} {via === "sms" ? "texted" : "messaged"} 🎉</p>}
      {noPhone.length > 0 && (
        <p className="text-[13px] text-dim">{V.none}: {noPhone.map((r, i) => <span key={r.id}>{i ? ", " : ""}{kind === "leads" ? r.first : <Link href={`/coach/clients/${r.id}`} className="underline">{r.first}</Link>}</span>)}</p>
      )}
    </div>
  );
}
