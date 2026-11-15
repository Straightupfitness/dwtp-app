import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadRoster } from "@/lib/roster";
import BackButton from "@/components/BackButton";
import TextQueue, { type TextRow } from "./TextQueue";

/**
 * November 15: Michael texts many clients from his own phone, like Hit 'Em Up. He writes one message with fill-ins
 * ({first}, {week}…); the app opens Messages with each client's personal version ready, one after another.
 */
export default async function TextPage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  if (me?.role !== "coach") redirect("/today");
  const { ids } = await searchParams;
  const want = new Set((ids ?? "").split(",").filter(Boolean));
  const roster = (await loadRoster(supabase)).filter((r) => want.has(r.id));
  const { data: phones } = await supabase.from("profiles").select("id, phone, full_name").in("id", [...want]);
  const ph = new Map((phones ?? []).map((p) => [p.id as string, p]));
  const rows: TextRow[] = roster.map((r) => {
    const full = ((ph.get(r.id)?.full_name as string | null) ?? r.name).trim();
    return {
      id: r.id, name: r.name, first: r.first, last: full.split(/\s+/).slice(1).join(" "), phone: (ph.get(r.id)?.phone as string | null) ?? null,
      week: r.week, weight: r.weight, goal: r.goalWeight,
    };
  });
  return (
    <section className="mx-auto max-w-2xl space-y-3.5">
      <BackButton fallback="/coach" />
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">From your own number</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[30px] font-semibold uppercase">Text {rows.length} client{rows.length === 1 ? "" : "s"}</h1>
      </header>
      {rows.length ? <TextQueue rows={rows} /> : <p className="text-dim">Pick clients on your Clients list first, then tap “📱 Text from my phone”.</p>}
    </section>
  );
}
