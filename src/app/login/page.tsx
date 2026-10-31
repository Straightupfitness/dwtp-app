"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sendSignInLink, signInWithCode } from "./actions";

const SAVED = "dwtp-signin-sent";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const [codeErr, setCodeErr] = useState("");
  const [checking, setChecking] = useState(false);
  const router = useRouter();

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setCodeErr("");
    setChecking(true);
    // Our own codes (any email from the last 2 hours works); the server signs her in and goes to Today.
    const r = await signInWithCode(email, code).catch(() => ({ error: "Sign-in hiccup. Try again, or tap the button in the email." }));
    if (r?.error) {
      // Older emails carried Supabase's code: try that too before saying no.
      const { error } = await createClient().auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: "email" });
      if (!error) { forget(); router.replace("/"); return; }
      setCodeErr(r.error);
    } else forget();
    setChecking(false);
  }
  const forget = () => { try { localStorage.removeItem(SAVED); } catch {} };

  // October 31: on iPhone the Home Screen app often reloads while she's in Mail, which used to drop her back on the
  // email box (and asking again sent a new code). Remember that an email went out, for 2 hours.
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(SAVED) ?? "null") as { email: string; at: number } | null;
      if (s && Date.now() - s.at < 2 * 3_600_000) { setEmail(s.email); setState("sent"); } // eslint-disable-line react-hooks/set-state-in-effect -- read once
    } catch {}
  }, []);

  // Coming back from a link that expired or was already used.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error")) {
      setState("error"); // eslint-disable-line react-hooks/set-state-in-effect -- read once from the URL
      setMessage("That sign-in link has expired or was already used. Enter your email and I'll send a fresh one.");
    }
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const r = await sendSignInLink(email).catch(() => ({ ok: false as const, reason: "failed" as const }));
    if (!r.ok) {
      setMessage(r.reason === "notfound"
        ? "I couldn't find that email. Use the email you signed up with, or message Michael."
        : r.reason === "toomany"
          ? "Several sign-in emails were just sent. Check your inbox (and spam), or wait 15 minutes and try again."
          : "The email didn't go out. Try again in a minute, or message Michael.");
    }
    if (r.ok) { try { localStorage.setItem(SAVED, JSON.stringify({ email: email.trim().toLowerCase(), at: Date.now() })); } catch {} }
    setState(r.ok ? "sent" : "error");
  }

  const display = "font-[family-name:var(--font-display)] uppercase";
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col px-6 pb-8 pt-[max(4.5rem,env(safe-area-inset-top))]">
      <div className="flex flex-col items-center gap-4">
        <Image src="/brand/dwtp-logo.png" alt="Driven Woman Transformation Program" width={236} height={114} priority className="mix-blend-lighten" />
        <p className={`${display} text-sm tracking-[0.2em] text-dim`}>
          Drained <span className="text-accent">·</span> Rested <span className="text-accent">·</span> Fueled <span className="text-accent">·</span> Driven
        </p>
      </div>
      {state === "sent" ? (
        <div className="mt-16 space-y-3">
          <h1 className={`${display} text-3xl font-semibold`}>Check your email</h1>
          <p className="text-[15px] leading-relaxed text-[#a8a8a8]">I sent a sign-in link to <b className="text-text">{email.trim().toLowerCase()}</b>. Tap the button in that email and you&apos;re in. Check spam if it isn&apos;t there in a minute.</p>
          <form onSubmit={verify} className="flex flex-col gap-2.5 pt-3">
            <label htmlFor="code" className="text-[13px] text-[#a8a8a8]">Or type the code from the email</label>
            <input id="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="min-h-[52px] rounded-[14px] border border-[#2a2a2a] bg-card px-4 text-[22px] tracking-[0.3em] outline-none focus:border-accent" />
            <button disabled={code.length !== 6 || checking} className="min-h-[50px] rounded-[14px] border border-accent text-[16px] font-semibold text-accent disabled:opacity-50">{checking ? "Checking…" : "Sign in with code"}</button>
            {codeErr && <p className="text-sm text-[var(--red)]">{codeErr}</p>}
          </form>
          <p className="text-[13px] text-dim">Any code from the last 2 hours works. No need to ask for another email.</p>
          <button type="button" onClick={() => { forget(); setCode(""); setCodeErr(""); setState("idle"); }} className="min-h-11 text-sm text-accent">Use a different email</button>
        </div>
      ) : (
        <>
          <div className="mt-16 space-y-2.5">
            <h1 className={`${display} text-[34px] font-semibold leading-tight`}>Welcome back</h1>
            <p className="text-[15px] leading-relaxed text-[#a8a8a8]">Enter the email you joined with. I&apos;ll send you a sign-in link. No password needed.</p>
          </div>
          <form onSubmit={send} className="mt-7 flex flex-col gap-3.5">
            <label htmlFor="email" className="text-[13px] text-[#a8a8a8]">Email</label>
            <input id="email" type="email" required autoComplete="email" autoCapitalize="none" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)}
              className="-mt-2 min-h-[52px] rounded-[14px] border border-[#2a2a2a] bg-card px-4 text-[17px] outline-none focus:border-accent" />
            <button disabled={state === "sending"}
              className="min-h-[54px] rounded-[14px] bg-accent text-[17px] font-semibold text-black disabled:opacity-60">
              {state === "sending" ? "Sending…" : "Send my sign-in link"}
            </button>
            {state === "error" && <p className="text-sm text-[var(--red)]">{message}</p>}
            <button type="button" onClick={() => { if (/^\S+@\S+\.\S+$/.test(email.trim())) setState("sent"); else { setState("error"); setMessage("Type your email first, then tap this again."); } }}
              className="min-h-11 text-sm text-accent">I already have a code</button>
          </form>
        </>
      )}
      <div className="mt-auto space-y-1.5 pt-10 text-center">
        <p className="text-[13px] text-dim">New to DWTP? Your login is ready the day you join.</p>
        <p className="text-xs uppercase tracking-[0.15em] text-dim">Straight Up Fitness</p>
      </div>
    </main>
  );
}
