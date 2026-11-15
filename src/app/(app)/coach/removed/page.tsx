import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";

/** November 15: clients Michael removed (status cancelled). Open one to restore her or delete her for good. */
export default async function RemovedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  if (me?.role !== "coach") redirect("/today");
  const { data } = await supabase.from("profiles").select("id, full_name, email, program_start").eq("role", "client").eq("status", "cancelled").order("full_name");
  return (
    <section className="mx-auto max-w-2xl space-y-3.5">
      <BackButton fallback="/coach" />
      <h1 className="font-[family-name:var(--font-display)] text-[30px] font-semibold uppercase">Removed clients</h1>
      <p className="text-[14px] text-dim">They can&apos;t open the app, and they&apos;re off your Clients list. Tap one to restore her or delete her for good.</p>
      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {(data ?? []).map((c) => (
          <li key={c.id}><Link href={`/coach/clients/${c.id}#remove`} className="flex min-h-14 items-center justify-between gap-2 px-3.5 py-2.5">
            <span className="min-w-0"><span className="block truncate text-[15px] font-semibold">{c.full_name ?? c.email}</span><span className="block truncate text-[12px] text-dim">{c.email}</span></span>
            <span className="text-dim" aria-hidden="true">›</span></Link></li>
        ))}
        {!data?.length && <li className="p-6 text-center text-[14px] text-dim">Nobody removed.</li>}
      </ul>
    </section>
  );
}
