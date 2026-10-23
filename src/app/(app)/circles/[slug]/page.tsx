import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadProgram, daysUntil, type ItemState, type RingState } from "@/lib/circles";
import { CIRCLE_CPS } from "@/lib/program";
import RingTarget from "@/components/RingTarget";
import ItemCheck from "../ItemCheck";

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
);
const Lock = ({ color }: { color: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
const TYPE_LABEL: Record<string, string> = { do: "Do", eat: "Eat", take: "Take", get: "Get", learn: "Learn", hit: "Hit" };

/** A habit in a ring that isn't open yet: shown as a preview, with credit if she's already doing it elsewhere. */
function PreviewItem({ it, color }: { it: ItemState; color: string }) {
  const credit = it.complete ? "Already done" : it.progress > 0
    ? `Already doing this${it.alsoIn.length ? ` in ${it.alsoIn.join(", ")}` : ""} · ${it.cadence === "weekly" ? "week" : "day"} ${it.progress} of ${it.target}` : null;
  return (
    <li className="py-1.5">
      <span className="text-xs uppercase tracking-wider text-dim">{TYPE_LABEL[it.type]}{it.cadence === "weekly" ? " · weekly" : ""} </span>
      <span className="text-sm">{it.title}</span>
      {credit && <span className="mt-0.5 block text-xs" style={{ color }}>{credit}</span>}
    </li>
  );
}

function OpenRing({ r }: { r: RingState }) {
  return (
    <div className="flex-1 space-y-2 rounded-2xl border bg-card p-3.5" style={{ borderColor: r.color }}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-xl uppercase">{r.name}</h2>
        <span className="shrink-0 text-xs text-dim">Day {r.day}</span>
      </div>
      {r.outcome && <p className="text-sm text-dim">{r.outcome}</p>}
      <div className="h-1.5 rounded-full bg-[#262626]"><div className="h-1.5 rounded-full" style={{ width: `${Math.round(r.fraction * 100)}%`, background: r.color }} /></div>
      <div className="divide-y divide-border">
        {r.items.map((it) => it.type === "hit" ? (
          <div key={it.id} className="flex min-h-11 items-start gap-3 py-2">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border-2 border-dashed"
              style={it.complete ? { background: r.color, borderColor: r.color } : { borderColor: "#3a3a3a" }}>{it.complete && <Check />}</span>
            <span className="flex-1">
              <span className="block text-[15px]">{it.title}</span>
              <span className="block text-xs text-dim">{it.complete ? "Signed off by Michael" : "Michael signs this off from your check-ins"}</span>
            </span>
          </div>
        ) : (
          <ItemCheck key={it.id} itemId={it.id} done={it.doneNow} complete={it.complete} title={it.title} detail={it.detail}
            progress={it.progress} target={it.target} cadence={it.cadence} color={r.color} alsoIn={it.alsoIn} auto={it.auto} />
        ))}
      </div>
    </div>
  );
}

function opensLabel(r: RingState, today: string) {
  const when = r.opensOn ? (daysUntil(today, r.opensOn) <= 7 ? `in ${daysUntil(today, r.opensOn)} days` : `Week ${r.planWeek}`) : null;
  if (r.halfwayOf) return `Opens when you're halfway through Ring ${r.halfwayOf}${when ? ` (or ${when})` : ""}`;
  return when ? `Opens ${when}` : "";
}

export default async function CirclePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const state = await loadProgram(supabase, user!.id);
  const c = state.circles.find((x) => x.slug === slug);
  if (!c) notFound();

  const firstUpcoming = c.rings.find((r) => r.status === "upcoming");
  const banner = c.status === "open" ? null
    : c.kind !== "growth" ? "Fix-its are opened by Michael when you need one. Ask him in your check-in or a message."
    : firstUpcoming?.opensOn ? `This circle opens ${daysUntil(state.today, firstUpcoming.opensOn) <= 7 ? `in ${daysUntil(state.today, firstUpcoming.opensOn)} days` : `in Week ${firstUpcoming.planWeek ?? c.firstPlanWeek}`}. Here's what's coming. Want to start early? Ask Michael.`
    : "Want to start this one early? Ask Michael and he can open it for you.";

  return (
    <section className="space-y-4">
      <Link href="/circles" className="inline-flex min-h-11 items-center gap-1 text-sm text-dim">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        Circles
      </Link>
      <header>
        {c.focus && <p className="text-xs uppercase tracking-[0.15em] text-accent">Focus circle</p>}
        <h1 className="font-[family-name:var(--font-display)] text-3xl uppercase">{c.name}</h1>
        {c.goal && <p className="mt-1 text-sm text-dim">Goal: {c.goal}</p>}
      </header>

      <div className="flex items-center gap-4">
        <RingTarget rings={c.rings.map((r) => ({ color: r.color, fraction: r.fraction }))} size={150}
          label={`${c.name}: ${c.ringsComplete} of ${c.rings.length} rings complete`} />
        <div>
          <p className="font-[family-name:var(--font-display)] text-4xl leading-none">{c.ringsComplete}<span className="text-xl text-dim"> / {c.rings.length}</span></p>
          <p className="text-sm text-dim">rings complete</p>
          <p className="mt-2 text-xs text-dim">50 CPs a ring · {CIRCLE_CPS} for the circle</p>
        </div>
      </div>

      {banner && <p className="rounded-xl border border-border bg-card p-3 text-sm">{banner}</p>}

      <ol className="relative space-y-2.5">
        <div className="absolute bottom-5 left-[17px] top-5 w-0.5 bg-[#262626]" aria-hidden="true" />
        {c.rings.map((r) => (
          <li key={r.id} className="relative flex gap-3.5">
            {r.status === "complete" ? (
              <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ background: r.color }}><Check /></span>
            ) : r.status === "open" ? (
              <span className="grid size-9 shrink-0 place-items-center rounded-full border-[3px] bg-bg font-[family-name:var(--font-display)]"
                style={{ borderColor: r.color, color: r.color }}>{r.number}</span>
            ) : (
              <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 bg-card" style={{ borderColor: `${r.color}73` }}><Lock color={r.color} /></span>
            )}

            {r.status === "open" ? <OpenRing r={r} /> : (
              <details className="group min-h-9 flex-1 pt-1.5">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-2">
                  <span>
                    <span className={`block text-[15px] ${r.status === "complete" ? "" : "text-[#a8a8a8]"}`}>{r.number} · {r.name}</span>
                    {r.status === "upcoming" && (
                      <span className="block text-xs" style={{ color: r.color }}>{opensLabel(r, state.today)}</span>
                    )}
                  </span>
                  {r.status === "complete"
                    ? <span className="shrink-0 text-xs text-gold">+{r.cps} CPs</span>
                    : <span className="shrink-0 text-xs text-dim group-open:hidden">Preview</span>}
                </summary>
                <ul className="mt-1">
                  {r.items.map((it) => <PreviewItem key={it.id} it={it} color={r.color} />)}
                </ul>
              </details>
            )}
          </li>
        ))}
        <li className="relative flex items-center gap-3.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-dashed border-[#818cf8] bg-card">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffcc75" strokeWidth="2" aria-hidden="true"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" /></svg>
          </span>
          <span>
            <span className="block text-[15px] text-[#a8a8a8]">Circle complete</span>
            <span className="block text-xs text-gold">+{CIRCLE_CPS} CPs</span>
          </span>
        </li>
      </ol>

      {c.seeAPro && (
        <p className="rounded-xl border border-border p-3 text-xs text-dim"><b className="text-text">See a doctor or physio if:</b> {c.seeAPro}</p>
      )}
    </section>
  );
}
