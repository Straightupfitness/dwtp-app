import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadFaq } from "@/lib/faq-server";
import FaqView from "./FaqView";

export default async function FaqPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: me }, sections] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user!.id).single(), loadFaq(supabase),
  ]);
  return (
    <section className="space-y-3.5">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Answers, lists and links</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-[30px] font-semibold uppercase">FAQ</h1>
        </div>
        {me?.role === "coach" && <Link href="/coach/faq" className="min-h-11 pt-3 text-sm text-accent">Edit FAQ</Link>}
      </header>
      <FaqView sections={sections} />
      <Link href="/chat" className="flex min-h-12 items-center justify-center rounded-2xl border border-border text-sm">Didn&apos;t find it? Ask Michael</Link>
    </section>
  );
}
