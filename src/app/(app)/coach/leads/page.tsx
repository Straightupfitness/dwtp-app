import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LeadsView, { type Lead } from "./LeadsView";

/** November 15: Michael's leads, women he's talking to who aren't clients yet. */
export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  if (me?.role !== "coach") redirect("/today");
  const cols = "id, first_name, last_name, email, phone, city, goals, notes, source, created_at, lead_type, time_slot, lead_source, contact_method, temperature";
  // November 19: the contact dates (SQL 33), read with everything else; without that column yet, the rest still loads.
  const withDates = await supabase.from("leads").select(`${cols}, last_heard_on, last_reached_on`).order("created_at", { ascending: false });
  const { data, error } = withDates.error ? await supabase.from("leads").select(cols).order("created_at", { ascending: false }) : withDates;
  return (
    <section className="mx-auto max-w-7xl space-y-3.5 pb-28">
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Not clients yet</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[30px] font-semibold uppercase">Leads</h1>
      </header>
      {error ? <p className="rounded-xl border border-[#3a2f12] bg-[#1a150a] p-3 text-[14px] text-[#e7d3a8]">Run the leads SQL file in Supabase to turn this on.</p>
        : <LeadsView leads={(data ?? []) as Lead[]} />}
    </section>
  );
}
