import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadProgram, daysUntil, type CircleState } from "@/lib/circles";
import MedalCircle from "@/components/MedalCircle";

function Medals({ c, size, center }: { c: CircleState; size: number; center?: boolean }) {
  return (
    <MedalCircle medals={c.rings.map((r) => r.fraction)} color={c.color} size={size}
      center={center ? `${c.ringsComplete}/${c.rings.length}` : undefined}
      label={`${c.name}: ${c.ringsComplete} of ${c.rings.length} medals`} />
  );
}
const Label = ({ children }: { children: React.ReactNode }) => (
  <h2 className="pt-2 text-[11px] uppercase tracking-[0.15em] text-accent">{children}</h2>
);
const pct = (c: CircleState) => Math.round((100 * c.rings.reduce((a, r) => a + r.fraction, 0)) / (c.rings.length || 1));

/** One circle as a row: its name in its color, a line under it, and its medals on the right. */
function Row({ c, sub, active = true }: { c: CircleState; sub: string; active?: boolean }) {
  return (
    <Link href={`/circles/${c.slug}`} className="flex min-h-[72px] items-center gap-3 px-3.5 py-2">
      <span className="min-w-0 flex-1">
        <span className="block font-[family-name:var(--font-display)] text-[19px] uppercase leading-tight" style={{ color: active ? c.color : "#cbd5e1" }}>{c.name}</span>
        <span className="block text-[13px] text-[#a8a8a8]">{sub}</span>
      </span>
      <Medals c={c} size={60} center />
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="2" aria-hidden="true" className="shrink-0"><path d="M9 6l6 6-6 6" /></svg>
    </Link>
  );
}
const List = ({ children }: { children: React.ReactNode }) => (
  <div className="divide-y divide-border rounded-2xl border border-border bg-card">{children}</div>
);

export default async function CirclesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const state = await loadProgram(supabase, user!.id);
  const growth = state.circles.filter((c) => c.kind === "growth");
  const focus = growth.filter((c) => c.focus);
  const alsoOpen = state.circles.filter((c) => !c.focus && c.status === "open");
  const coming = growth.filter((c) => !c.focus && c.status !== "open")
    .sort((a, b) => (a.firstPlanWeek ?? 99) - (b.firstPlanWeek ?? 99));
  const fixits = state.circles.filter((c) => c.kind !== "growth" && c.status !== "open");

  const opens = (c: CircleState) => {
    const next = c.rings.find((r) => r.status === "upcoming");
    const n = next?.opensOn ? daysUntil(state.today, next.opensOn) : null;
    return n === null ? "Michael opens it for you" : n <= 0 ? "Opens today" : n === 1 ? "Opens tomorrow" : `Opens in ${n} days`;
  };
  const progress = (c: CircleState) => (c.ringsComplete === c.rings.length ? "Complete" : `${pct(c)}% complete`);

  return (
    <section className="space-y-3">
      <header>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Build the foundation</p>
          <Link href="/circles/how" className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-accent px-3 text-[13px] font-semibold text-accent">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
            How this works
          </Link>
        </div>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl uppercase">Capacity Circles</h1>
      </header>

      <Label>Here are the three circles I want you to prioritize:</Label>
      <List>{focus.map((c) => <Row key={c.id} c={c} sub={progress(c)} />)}</List>

      {alsoOpen.length > 0 && <>
        <Label>Here are circles you are also working on:</Label>
        <List>{alsoOpen.map((c) => <Row key={c.id} c={c} sub={progress(c)} />)}</List>
      </>}

      {coming.length > 0 && <>
        <Label>Circles coming soon:</Label>
        <List>{coming.map((c) => <Row key={c.id} c={c} sub={opens(c)} active={false} />)}</List>
      </>}

      {fixits.length > 0 && <>
        <Label>Here are fix-it circles you can start when you need them:</Label>
        <List>{fixits.map((c) => <Row key={c.id} c={c} sub={`${c.rings.length} medals · start it when you need it`} active={false} />)}</List>
      </>}
    </section>
  );
}
