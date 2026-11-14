"use client";
import { useState } from "react";
import { signInCodeFor } from "@/app/(app)/coach/clients/[id]/signin-actions";

/** November 13: a sign-in code Michael can text her when the email doesn't reach her. */
export default function SignInCodeButton({ clientId, first, phone }: { clientId: string; first: string; phone: string | null }) {
  const [r, setR] = useState<{ code: string; email: string | null; emailsLast2h: number } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const msg = r ? `Hi ${first}! Here's your DWTP sign-in code: ${r.code}\n\nOpen the app, type your email (${r.email ?? "the one you joined with"}), tap "I already have a code" and enter it. It works for 2 hours.` : "";
  const digits = phone?.replace(/[^\d+]/g, "") ?? "";
  const num = /^\d{10}$/.test(digits) ? `+1${digits}` : digits;
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3 text-sm">
      {!r ? (
        <button type="button" disabled={busy} onClick={async () => { setBusy(true); setErr(""); const x = await signInCodeFor(clientId); setBusy(false); if ("error" in x && x.error) setErr(x.error); else if (x.code) setR({ code: x.code, email: x.email ?? null, emailsLast2h: x.emailsLast2h ?? 0 }); }}
          className="min-h-10 w-full rounded-lg border border-border text-[13px] font-semibold disabled:opacity-50">{busy ? "Making a code…" : `🔑 Can't sign in? Get a sign-in code for ${first}`}</button>
      ) : (
        <>
          <p className="text-[13px] text-dim">Sign-in code (works for 2 hours){r.email ? ` · her email: ${r.email}` : ""}</p>
          <p className="text-[30px] font-bold tracking-[0.25em] text-accent">{r.code}</p>
          <p className="text-[12px] text-dim">Sign-in emails sent to her in the last 2 hours: {r.emailsLast2h}{r.emailsLast2h >= 5 ? " (she hit the limit; that's why no more came)" : ""}</p>
          {num && <a href={`sms:${num}?&body=${encodeURIComponent(msg)}`} className="flex min-h-10 items-center justify-center rounded-lg bg-accent text-[13px] font-semibold text-black">📱 Text it to {first}</a>}
        </>
      )}
      {err && <p className="text-[var(--red)]">{err}</p>}
    </div>
  );
}
