"use client";
import Image from "next/image";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback`, shouldCreateUser: false },
    });
    if (error) {
      const m = error.message.toLowerCase();
      setMessage(
        m.includes("signups not allowed") || m.includes("not found")
          ? "We couldn't find that email. Use the email you signed up with, or message Michael."
          : m.includes("rate limit") || error.status === 429
            ? "Too many sign-in emails were sent in a short time. Wait a few minutes and try again."
            : `Something went wrong: ${error.message}`,
      );
    }
    setState(error ? "error" : "sent");
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
          <p className="text-[15px] leading-relaxed text-[#a8a8a8]">I sent a sign-in link to <b className="text-text">{email.trim().toLowerCase()}</b>. Tap it on this phone and you&apos;re in.</p>
          <button type="button" onClick={() => setState("idle")} className="min-h-11 text-sm text-accent">Use a different email</button>
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
