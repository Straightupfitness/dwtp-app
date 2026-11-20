import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadRoster } from "@/lib/roster";
import BackButton from "@/components/BackButton";
import TextQueue, { type TextRow, type Via } from "./TextQueue";

/**
 * November 15: Michael texts many clients from his own phone, like Hit 'Em Up. He writes one message with fill-ins
 * ({first}, {week}…); the app opens Messages with each client's personal version ready, one after another.
 */
export default async function TextPage({ searchParams }: { searchParams: Promise<{ ids?: string; kind?: string; via?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  if (me?.role !== "coach") redirect("/today");
  const sp = await searchParams;
  const { ids, kind } = sp;
  const want = new Set((ids ?? "").split(",").filter(Boolean));
  if (kind === "leads") {
    // November 15: the same flow for leads (fill-ins: first, last, city).
    // November 20: or by Facebook Messenger / Instagram (?via=messenger|instagram), using her usernames (SQL 34).
    const via: Via = sp.via === "messenger" || sp.via === "instagram" ? sp.via : "sms";
    const base = "id, first_name, last_name, phone, city, time_slot";
    const withSocial = await supabase.from("leads").select(`${base}, facebook, instagram`).in("id", [...want]);
    const { data } = withSocial.error ? await supabase.from("leads").select(base).in("id", [...want]) : withSocial;
    const leads: TextRow[] = ((data ?? []) as Record<string, string | null>[]).map((l) => ({ id: l.id as string, name: `${l.first_name} ${l.last_name}`.trim() || "(no name)", first: l.first_name || "there",
      last: l.last_name ?? "", phone: l.phone ?? null, city: l.city ?? null, time: l.time_slot ?? null,
      handle: via === "messenger" ? l.facebook ?? null : via === "instagram" ? l.instagram ?? null : null }));
    const what = via === "messenger" ? "Message" : via === "instagram" ? "DM" : "Text";
    return (
      <section className="mx-auto max-w-2xl space-y-3.5">
        <BackButton fallback="/coach/leads" />
        <header>
          <p className="text-[11px] uppercase tracking-[0.15em] text-accent">{via === "messenger" ? "From your Facebook" : via === "instagram" ? "From the SUFitness Instagram" : "From your own number"}</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-[30px] font-semibold uppercase">{what} {leads.length} lead{leads.length === 1 ? "" : "s"}</h1>
        </header>
        {leads.length ? <TextQueue rows={leads} kind="leads" via={via} /> : <p className="text-dim">Pick leads on your Leads tab first.</p>}
      </section>
    );
  }
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
