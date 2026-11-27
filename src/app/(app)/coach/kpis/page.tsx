import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import KpiView, { type Data } from "./KpiView";
import SmoothDrawers from "@/components/SmoothDrawers";

export const dynamic = "force-dynamic";

/** November 17 (Michael): his business numbers. November 19: income, expenses and net up top, then his planner. */
export default async function KpisPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  if (me?.role !== "coach") redirect("/today");
  const [ex, sl, cl, pa, le, it] = await Promise.all([
    supabase.from("kpi_expenses").select("*").order("position").order("created_at"),
    supabase.from("kpi_slots").select("*").order("position").order("created_at"),
    supabase.from("kpi_clients").select("*").order("position").order("created_at"),
    supabase.from("kpi_payments").select("*").order("paid_on", { ascending: false }),
    supabase.from("leads").select("temperature"),
    supabase.from("kpi_items").select("id, kind, parent_id, text, note, quadrant, position, done, collapsed, sched_at, sched_minutes").order("position"),
  ]);
  const missing = [ex, sl, cl, pa].some((r) => r.error);
  // November 20: before the scheduler SQL (36), read the planner without its scheduling columns.
  // November 20: his repeating events and birthdays (SQL 37); without the table, the calendar just has none.
  // November 26: one-time events and reminders (SQL 41); before it, read without those columns.
  let ev = await supabase.from("kpi_events").select("id, title, kind, weekday, month, day, start_min, minutes, icon, note, on_date, remind_min").order("start_min", { nullsFirst: true });
  if (ev.error) ev = await supabase.from("kpi_events").select("id, title, kind, weekday, month, day, start_min, minutes, icon, note").order("start_min", { nullsFirst: true }) as typeof ev;
  const items = it.error ? await supabase.from("kpi_items").select("id, kind, parent_id, text, note, quadrant, position, done, collapsed").order("position") : it;
  // Today in Los Angeles, so "this month" and "coming up" match his calendar.
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const data: Data = {
    expenses: (ex.data ?? []) as Data["expenses"], slots: (sl.data ?? []) as Data["slots"], clients: (cl.data ?? []) as Data["clients"],
    payments: (pa.data ?? []) as Data["payments"], leads: ((le.data ?? []) as { temperature: string | null }[]).map((l) => l.temperature), today,
    items: (items.data ?? []) as Data["items"], planReady: !items.error, events: (ev.error ? [] : ev.data ?? []) as Data["events"],
  };
  return (
    <section className="mx-auto max-w-6xl space-y-3.5 pb-28">
      {/* November 20: the KPIs and Schedule titles are collapsible (inside KpiView). */}
      {missing ? <p className="rounded-xl border border-[#3a2f12] bg-[#1a150a] p-3 text-[14px] text-[#e7d3a8]">Run the KPIs SQL file in Supabase to turn this on.</p> : <KpiView d={data} />}
      <SmoothDrawers />
    </section>
  );
}
