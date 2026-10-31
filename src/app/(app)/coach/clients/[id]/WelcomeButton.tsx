"use client";
import { useState } from "react";
import { resendWelcome, signInLinkFor } from "./actions";

export default function WelcomeButton({ clientId, failed }: { clientId: string; failed?: boolean }) {
  const [s, setS] = useState<"idle" | "sending" | "sent" | "error">(failed ? "error" : "idle");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={s === "sending"} onClick={async () => { setS("sending"); const r = await resendWelcome(clientId).catch(() => ({ ok: false })); setS(r.ok ? "sent" : "error"); }}
        className="min-h-10 rounded-lg border border-accent px-3 text-[13px] font-semibold text-accent disabled:opacity-60">
        {s === "sending" ? "Sending…" : s === "sent" ? "Sent ✓ Send again" : "Send welcome link"}
      </button>
      <TextLink clientId={clientId} />
      {s === "error" && <span className="text-xs text-[var(--red)]">The welcome email didn&apos;t go out. Try again.</span>}
      {s === "sent" && <span className="text-xs text-dim">She&apos;ll get a link, good for 14 days.</span>}
    </div>
  );
}

/**
 * "Text her a link": a sign-in link to copy or send by text, for when the email doesn't reach her
 * (spam, Yahoo, an old email). It works for 14 days and doesn't cancel other links.
 */
function TextLink({ clientId }: { clientId: string }) {
  const [l, setL] = useState<{ link: string; first: string; phone: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!l) return (
    <button type="button" disabled={busy} onClick={async () => { setBusy(true); setL(await signInLinkFor(clientId)); setBusy(false); }}
      className="min-h-10 rounded-lg border border-border px-3 text-[13px] font-semibold disabled:opacity-60">{busy ? "Making…" : "Text her a sign-in link"}</button>
  );
  const msg = `Hi ${l.first || "there"}, here's your DWTP sign-in link. Tap it, then tap "Open my app": ${l.link}`;
  return (
    <div className="w-full space-y-2 rounded-xl border border-border bg-card p-3">
      <p className="break-all text-[12px] text-dim">{l.link}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(msg); setCopied(true); } catch { /* no clipboard */ } }}
          className="min-h-10 rounded-lg bg-accent px-3 text-[13px] font-semibold text-black">{copied ? "Copied ✓" : "Copy message"}</button>
        <a href={`sms:${l.phone ?? ""}${/iphone|ipad/i.test(typeof navigator === "undefined" ? "" : navigator.userAgent) ? "&" : "?"}body=${encodeURIComponent(msg)}`}
          className="flex min-h-10 items-center rounded-lg border border-border px-3 text-[13px] font-semibold">Text it{l.phone ? "" : " (add her number)"}</a>
      </div>
      <p className="text-[11px] text-dim">Works for 14 days, on any phone. She taps it, then &ldquo;Open my app&rdquo;.</p>
    </div>
  );
}
