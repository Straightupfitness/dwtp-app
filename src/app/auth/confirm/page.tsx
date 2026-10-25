import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * The sign-in link lands here. She taps once more to sign in: some email apps open
 * links in the background to scan them, and that would use up a one-time link.
 */
async function confirm(form: FormData) {
  "use server";
  const token_hash = String(form.get("token_hash") ?? "");
  const type = form.get("type") === "email" ? "email" : "magiclink";
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash, type });
  redirect(error ? "/login?error=expired" : "/");
}

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string }> }) {
  const { token_hash, type } = await searchParams;
  if (!token_hash) redirect("/login?error=expired");
  const display = "font-[family-name:var(--font-display)] uppercase";
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col px-6 pb-8 pt-[max(4.5rem,env(safe-area-inset-top))]">
      <div className="flex flex-col items-center">
        <Image src="/brand/dwtp-logo.png" alt="Driven Woman Transformation Program" width={236} height={114} priority className="mix-blend-lighten" />
      </div>
      <h1 className={`${display} mt-16 text-[34px] font-semibold leading-tight`}>You&apos;re one tap away</h1>
      <form action={confirm} className="mt-7">
        <input type="hidden" name="token_hash" value={token_hash} />
        <input type="hidden" name="type" value={type ?? "magiclink"} />
        <button className="min-h-[54px] w-full rounded-[14px] bg-accent text-[17px] font-semibold text-black">Sign in</button>
      </form>
    </main>
  );
}
