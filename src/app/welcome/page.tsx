import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminClient, safeError } from "@/lib/supabase/admin";
import { findInvite, sendWelcome } from "@/lib/invite";

/** Her one tap from the welcome email: sign her in and go straight to Today. */
async function open(form: FormData) {
  "use server";
  const t = String(form.get("t") ?? "");
  const inv = await findInvite(t);
  if (!inv?.valid) redirect(`/welcome?t=${encodeURIComponent(t)}`);
  const db = adminClient();
  // Use it up first, so a link can only ever sign in once.
  const { data: claimed } = await db.from("invites").update({ used_at: new Date().toISOString() })
    .eq("id", inv.id).is("used_at", null).select("id").maybeSingle();
  if (!claimed) redirect(`/welcome?t=${encodeURIComponent(t)}`);
  const { data: p } = await db.from("profiles").select("email").eq("id", inv.user_id).single();
  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email: p!.email! });
  if (error || !data?.properties?.hashed_token) { console.error("welcome sign-in failed", safeError(error)); redirect("/login?error=expired"); }
  const supabase = await createClient();
  const { error: vErr } = await supabase.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
  redirect(vErr ? "/login?error=expired" : "/");
}

/** The link expired or was used: one tap sends a fresh one. */
async function resend(form: FormData) {
  "use server";
  const t = String(form.get("t") ?? "");
  const inv = await findInvite(t);
  if (!inv) redirect("/login");
  const db = adminClient();
  const { count } = await db.from("invites").select("id", { count: "exact", head: true })
    .eq("user_id", inv.user_id).gte("created_at", new Date(Date.now() - 3_600_000).toISOString());
  if ((count ?? 0) < 5) {
    const { data: p } = await db.from("profiles").select("email, full_name").eq("id", inv.user_id).single();
    if (p?.email) await sendWelcome(inv.user_id, p.email, p.full_name);
  }
  redirect("/welcome?sent=1");
}

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ t?: string; sent?: string }> }) {
  const { t = "", sent } = await searchParams;
  const display = "font-[family-name:var(--font-display)] uppercase";
  const button = "min-h-[54px] w-full rounded-[14px] bg-accent text-[17px] font-semibold text-black";

  let body: React.ReactNode;
  if (sent) {
    body = <>
      <h1 className={`${display} text-[34px] font-semibold leading-tight`}>Check your email</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[#a8a8a8]">I sent you a fresh link. Tap the button in that email and you&apos;re in.</p>
    </>;
  } else {
    const inv = await findInvite(t);
    if (inv && !inv.valid) {
      // Already used: if she's signed in on this phone, just take her in.
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id === inv.user_id) redirect("/");
    }
    if (inv?.valid) {
      const { data: p } = await adminClient().from("profiles").select("full_name").eq("id", inv.user_id).single();
      const first = p?.full_name?.split(" ")[0];
      body = <>
        <h1 className={`${display} text-[34px] font-semibold leading-tight`}>Welcome{first ? `, ${first}` : ""}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#a8a8a8]">Your app is ready: your habits, food, check-ins and messages with Michael, all in one place.</p>
        <form action={open} className="mt-7"><input type="hidden" name="t" value={t} /><button className={button}>Open my app</button></form>
      </>;
    } else if (inv) {
      body = <>
        <h1 className={`${display} text-[34px] font-semibold leading-tight`}>This link has expired</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#a8a8a8]">Welcome links work once, for 14 days. Tap below and I&apos;ll email you a fresh one.</p>
        <form action={resend} className="mt-7"><input type="hidden" name="t" value={t} /><button className={button}>Send me a new link</button></form>
      </>;
    } else redirect("/login");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col px-6 pb-8 pt-[max(4.5rem,env(safe-area-inset-top))]">
      <div className="flex flex-col items-center gap-4">
        <Image src="/brand/dwtp-logo.png" alt="Driven Woman Transformation Program" width={236} height={114} priority className="mix-blend-lighten" />
        <p className={`${display} text-sm tracking-[0.2em] text-dim`}>
          Drained <span className="text-accent">·</span> Rested <span className="text-accent">·</span> Fueled <span className="text-accent">·</span> Driven
        </p>
      </div>
      <div className="mt-16">{body}</div>
    </main>
  );
}
