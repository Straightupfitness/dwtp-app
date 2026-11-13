import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadRoster } from "@/lib/roster";
import BriefPanel from "@/components/BriefPanel";
import BlueprintReply from "@/components/BlueprintReply";
import BackButton from "@/components/BackButton";
import type { Brief } from "@/lib/ai/client-brief";

const display = "font-[family-name:var(--font-display)] uppercase";
const TABS = [
  { key: "not-started", label: "Not started", blurb: "Hasn't opened her Blueprint yet. Get her to do it before Sunday night." },
  { key: "started", label: "Stuck", blurb: "Started her Blueprint and stopped partway. Help her finish." },
  { key: "done", label: "Done", blurb: "Sent her Blueprint. Record your video reply (talking points on screen), or send a quick message." },
] as const;
const seenText = (h: number | null) => h === null ? "not seen yet" : h < 1 ? "in the app just now" : h < 48 ? `in the app ${h} h ago` : `in the app ${Math.round(h / 24)} days ago`;

/**
 * November 13: Michael's Blueprint follow-up queue. Everyone who needs a personal message, by where she is with her
 * Blueprint. Tap a name: the AI reads her last 48 hours and gives him bullets; he messages her in the app and by text,
 * then marks her sent.
 */
export default async function FollowupsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  if (me?.role !== "coach") redirect("/today");
  const { tab: t } = await searchParams;
  const tab = TABS.find((x) => x.key === t) ?? TABS[0];

  const roster = (await loadRoster(supabase)).filter((r) => r.status !== "cancelled");
  const ids = roster.map((r) => r.id);
  const [{ data: phones }, { data: fu, error: fuErr }, { data: replies }] = await Promise.all([
    supabase.from("profiles").select("id, phone").in("id", ids),
    supabase.from("coach_followups").select("client_id, brief, done_at").eq("topic", "blueprint").in("client_id", ids),
    supabase.from("coach_followups").select("client_id, brief, done_at").eq("topic", "blueprint-reply").in("client_id", ids),
  ]);
  const phone = new Map((phones ?? []).map((p) => [p.id as string, (p.phone as string | null) ?? null]));
  const f = new Map((fu ?? []).map((x) => [x.client_id as string, x]));
  const rp = new Map((replies ?? []).map((x) => [x.client_id as string, x]));
  const count = (k: string) => roster.filter((r) => r.blueprint === k && !f.get(r.id)?.done_at).length;
  const list = roster.filter((r) => r.blueprint === tab.key)
    .sort((a, b) => (a.hoursSinceSeen ?? 9999) - (b.hoursSinceSeen ?? 9999));
  const open = list.filter((r) => !f.get(r.id)?.done_at), sent = list.filter((r) => f.get(r.id)?.done_at);

  const card = (r: (typeof list)[number]) => {
    const x = f.get(r.id);
    return (
      <details key={r.id} className="group rounded-2xl border border-border bg-card">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-3.5 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">{r.name}</span>
            <span className="block text-[12px] text-dim">{seenText(r.hoursSinceSeen)} · food {r.foodDays7}/7 days · weighed in {r.weighins7}/7</span>
          </span>
          {x?.brief ? <span className="text-[11px] text-accent">bullets ready</span> : null}
          <span className="text-dim transition-transform group-open:rotate-90" aria-hidden="true">›</span>
        </summary>
        <div className="space-y-3 border-t border-border px-3.5 pb-3.5 pt-3">
          {tab.key === "done" && (
            <BlueprintReply clientId={r.id} first={r.first} initial={(rp.get(r.id)?.brief as { groups: { h: string; items: string[] }[]; at: string } | null) ?? null}
              sentAt={(rp.get(r.id)?.done_at as string | null) ?? null} />
          )}
          <BriefPanel compact clientId={r.id} first={r.first} phone={phone.get(r.id) ?? null} topic="blueprint"
            initial={(x?.brief as Brief | null) ?? null} doneAt={(x?.done_at as string | null) ?? null} />
          <Link href={`/coach/clients/${r.id}`} className="mt-2 block text-center text-[12px] text-dim underline">Her full page</Link>
        </div>
      </details>
    );
  };

  return (
    <section className="mx-auto max-w-2xl space-y-3.5">
      <BackButton fallback="/coach" />
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Personal messages</p>
        <h1 className={`${display} mt-1 text-[30px] font-semibold`}>Blueprint follow-ups</h1>
        <p className="mt-1 text-[14px] text-[#a8a8a8]">Tap a client, then <b>✨ What has she been doing?</b> You get her last 48 hours and the flow for your message. Write it your way, send it in the app and by text, then mark her sent.</p>
      </header>
      {fuErr && <p className="rounded-xl border border-[#3a2f12] bg-[#1a150a] p-3 text-[13px] text-[#e7d3a8]">Run the follow-ups SQL file in Supabase so “Mark sent” and saved bullets work.</p>}
      <nav className="grid grid-cols-3 gap-1.5" aria-label="Where she is with her Blueprint">
        {TABS.map((x) => (
          <Link key={x.key} href={`/coach/followups?tab=${x.key}`} aria-current={x.key === tab.key ? "page" : undefined}
            className={`flex min-h-12 flex-col items-center justify-center rounded-xl border text-[13px] ${x.key === tab.key ? "border-accent bg-accent font-semibold text-black" : "border-border"}`}>
            {x.label}<span className={`text-[11px] ${x.key === tab.key ? "text-black/70" : "text-dim"}`}>{count(x.key)} to message</span>
          </Link>
        ))}
      </nav>
      <p className="text-[13px] text-dim">{tab.blurb}</p>
      <div className="space-y-2">{open.length ? open.map(card) : <p className="rounded-2xl border border-dashed border-[#2f2f2f] p-6 text-center text-[14px] text-dim">Everyone here has a message from you. 🎉</p>}</div>
      {sent.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none pt-2 text-[11px] uppercase tracking-[0.15em] text-dim">Sent ({sent.length}) <span className="inline-block transition-transform group-open:rotate-90">›</span></summary>
          <div className="mt-2 space-y-2 opacity-80">{sent.map(card)}</div>
        </details>
      )}
    </section>
  );
}
