import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import KpiView, { type Data } from "./KpiView";

export const dynamic = "force-dynamic";

/** November 17 (Michael): his business numbers. Income by time slot, expenses, renewals coming up, leads. */
export default async function KpisPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  if (me?.role !== "coach") redirect("/today");
  const [ex, sl, cl, pa, le] = await Promise.all([
    supabase.from("kpi_expenses").select("*").order("position").order("created_at"),
    supabase.from("kpi_slots").select("*").order("position").order("created_at"),
    supabase.from("kpi_clients").select("*").order("position").order("created_at"),
    supabase.from("kpi_payments").select("*").order("paid_on", { ascending: false }),
    supabase.from("leads").select("temperature"),
  ]);
  const missing = [ex, sl, cl, pa].some((r) => r.error);
  // Today in Los Angeles, so "this month" and "coming up" match his calendar.
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const data: Data = {
    expenses: (ex.data ?? []) as Data["expenses"], slots: (sl.data ?? []) as Data["slots"], clients: (cl.data ?? []) as Data["clients"],
    payments: (pa.data ?? []) as Data["payments"], leads: ((le.data ?? []) as { temperature: string | null }[]).map((l) => l.temperature), today,
  };
  return (
    <section className="mx-auto max-w-6xl space-y-3.5 pb-28">
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Your business</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[30px] font-semibold uppercase">KPIs</h1>
      </header>
      {missing ? <p className="rounded-xl border border-[#3a2f12] bg-[#1a150a] p-3 text-[14px] text-[#e7d3a8]">Run the KPIs SQL file in Supabase to turn this on.</p> : <KpiView d={data} />}
    </section>
  );
}
