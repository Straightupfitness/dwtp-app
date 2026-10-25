"use client";
import { useState } from "react";
import { resendWelcome } from "./actions";

export default function WelcomeButton({ clientId, failed }: { clientId: string; failed?: boolean }) {
  const [s, setS] = useState<"idle" | "sending" | "sent" | "error">(failed ? "error" : "idle");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={s === "sending"} onClick={async () => { setS("sending"); const r = await resendWelcome(clientId).catch(() => ({ ok: false })); setS(r.ok ? "sent" : "error"); }}
        className="min-h-10 rounded-lg border border-accent px-3 text-[13px] font-semibold text-accent disabled:opacity-60">
        {s === "sending" ? "Sending…" : s === "sent" ? "Sent ✓ Send again" : "Send welcome link"}
      </button>
      {s === "error" && <span className="text-xs text-[var(--red)]">The welcome email didn&apos;t go out. Try again.</span>}
      {s === "sent" && <span className="text-xs text-dim">She&apos;ll get a one-tap link, good for 14 days.</span>}
    </div>
  );
}
