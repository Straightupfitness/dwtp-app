import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadProgram, daysUntil, type CircleState } from "@/lib/circles";
import { PHASE_LABEL } from "@/lib/program";
import MedalCircle from "@/components/MedalCircle";

function Medals({ c, size, center }: { c: CircleState; size: number; center?: boolean }) {
  return (
    <MedalCircle medals={c.rings.map((r) => r.fraction)} color={c.color} size={size}
      center={center ? `${c.ringsComplete}/${c.rings.length}` : undefined}
      label={`${c.name}: ${c.ringsComplete} of ${c.rings.length} medals`} />
  );
}
const Label = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-2 text-xs uppercase tracking-[0.15em] text-accent">{children}</h2>
);

export default async function CirclesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [state, { data: cps }] = await Promise.all([
    loadProgram(supabase, user!.id),
    supabase.from("cp_totals").select("total, this_week").eq("client_id", user!.id).maybeSingle(),
  ]);
  const growth = state.circles.filter((c) => c.kind === "growth");
  const focus = growth.filter((c) => c.focus);
  const alsoOpen = state.circles.filter((c) => !c.focus && c.status === "open");
  const coming = growth.filter((c) => !c.focus && c.status !== "open")
    .sort((a, b) => (a.firstPlanWeek ?? 99) - (b.firstPlanWeek ?? 99));
  const fixits = state.circles.filter((c) => c.kind !== "growth" && c.status !== "open");

  const phase = state.week <= 4 ? "rested" : state.week <= 16 ? "fueled" : "driven";
  return (
    <section className="space-y-3">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-accent">
            {state.week ? `Week ${state.week} · ${PHASE_LABEL[phase]}` : "Your circles"}
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl uppercase">Capacity Circles</h1>
        </div>
        <div className="text-right">
          <p className="font-[family-name:var(--font-display)] text-2xl text-gold">{cps?.total ?? 0} <span className="text-sm">CPs</span></p>
          <p className="text-xs text-dim">+{cps?.this_week ?? 0} this week</p>
        </div>
      </header>

      <Label>Your 3 focus circles</Label>
      <div className="grid grid-cols-3 gap-2">
        {focus.map((c) => (
          <Link key={c.id} href={`/circles/${c.slug}`} className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card px-1 pb-2.5 pt-3 text-center">
            <Medals c={c} size={96} center />
            <span className="font-[family-name:var(--font-display)] text-[15px] uppercase leading-tight">{c.name}</span>
            <span className="text-xs" style={{ color: c.color }}>
              {c.current ? `Medal ${c.current.number} · day ${Math.min(c.current.day, 14)}`
                : c.ringsComplete === c.rings.length ? "Complete" : state.week ? "Next medal soon" : "Starts Monday"}
            </span>
          </Link>
        ))}
      </div>

      {alsoOpen.length > 0 && (
        <>
          <Label>Also in progress <span className="normal-case tracking-normal text-dim">· from your weekly plan</span></Label>
          <div className="grid grid-cols-2 gap-2">
            {alsoOpen.map((c) => (
              <Link key={c.id} href={`/circles/${c.slug}`} className="flex min-h-11 items-center gap-2.5 rounded-xl border border-border bg-card p-2.5">
                <Medals c={c} size={38} />
                <span className="min-w-0">
                  <span className="block truncate text-sm">{c.name}</span>
                  <span className="block text-xs text-dim">{c.current ? `Medal ${c.current.number} · day ${Math.min(c.current.day, 14)}` : `${c.ringsComplete}/${c.rings.length} medals`}</span>
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {coming.length > 0 && (
        <>
          <Label>Coming up</Label>
          <div className="grid grid-cols-3 gap-2">
            {coming.map((c) => {
              const next = c.rings.find((r) => r.status === "upcoming");
              const n = next?.opensOn ? daysUntil(state.today, next.opensOn) : null;
              const when = n !== null ? (n <= 1 ? (n <= 0 ? "Opens today" : "Tomorrow") : `In ${n} days`) : "Ask Michael";
              return (
                <Link key={c.id} href={`/circles/${c.slug}`} className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card px-1 py-2.5 text-center">
                  <Medals c={c} size={40} />
                  <span className="text-xs leading-tight">{c.name}</span>
                  <span className="text-[11px] text-dim">{when}</span>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <Label>Fix-its</Label>
      <div className="flex flex-wrap gap-2">
        {fixits.map((c) => (
          <Link key={c.id} href={`/circles/${c.slug}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#2a2a2a] px-3.5 text-sm">
            <span className="size-2 rounded-full" style={{ background: c.color }} aria-hidden="true" />
            {c.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
