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

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <Image src="/brand/dwtp-logo.png" alt="DWTP" width={220} height={110} className="mx-auto" priority />
      {state === "sent" ? (
        <p className="text-center">Check your email. Tap the link to sign in.</p>
      ) : (
        <form onSubmit={send} className="flex flex-col gap-3">
          <label htmlFor="email" className="text-dim text-sm">Your email</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-border bg-card px-4 py-3 text-base outline-none focus:border-accent" />
          <button disabled={state === "sending"}
            className="rounded-lg bg-accent px-4 py-3 font-semibold text-black disabled:opacity-60">
            {state === "sending" ? "Sending…" : "Send me a sign-in link"}
          </button>
          {state === "error" && <p className="text-sm text-[var(--red)]">{message}</p>}
        </form>
      )}
    </main>
  );
}
