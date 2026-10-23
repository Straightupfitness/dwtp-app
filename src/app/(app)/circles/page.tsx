import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadProgram, daysUntil, type CircleState } from "@/lib/circles";
import { PHASE_LABEL } from "@/lib/program";

function Donut({ c, size }: { c: CircleState; size: number }) {
  // One segment per ring, in that ring's color: complete rings full, the current ring partly.
  const r = size / 2 - 4, circ = 2 * Math.PI * r, seg = circ / c.rings.length;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
      aria-label={`${c.ringsComplete} of ${c.rings.length} rings complete`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#262626" strokeWidth={size > 40 ? 6 : 4} />
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {c.rings.map((ring, i) => ring.fraction > 0 && (
          <circle key={ring.id} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ring.color} strokeWidth={size > 40 ? 6 : 4}
            strokeDasharray={`0 ${i * seg} ${Math.max(1, seg * ring.fraction - 1)} ${circ}`} />
        ))}
      </g>
      {size > 40 && (
        <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fill="#f5f5f5" fontSize="14" fontFamily="Oswald, sans-serif">
          {c.ringsComplete}/{c.rings.length}
        </text>
      )}
    </svg>
  );
}

const Chevron = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="2" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
);
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
            {state.week ? `Week ${state.week} · ${PHASE_LABEL[phase]}` : "Starts Monday"}
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl uppercase">Capacity Circles</h1>
        </div>
        <div className="text-right">
          <p className="font-[family-name:var(--font-display)] text-2xl text-gold">{cps?.total ?? 0} <span className="text-sm">CPs</span></p>
          <p className="text-xs text-dim">+{cps?.this_week ?? 0} this week</p>
        </div>
      </header>

      <Label>Your 3 focus circles</Label>
      {focus.map((c) => (
        <Link key={c.id} href={`/circles/${c.slug}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
          <Donut c={c} size={56} />
          <div className="min-w-0 flex-1">
            <p className="font-[family-name:var(--font-display)] text-lg uppercase">{c.name}</p>
            {c.current ? (
              <>
                <p className="truncate text-sm text-dim">Ring {c.current.number} · {c.current.name} · day {Math.min(c.current.day, 14)} of 14</p>
                <div className="mt-1.5 h-1.5 rounded-full bg-[#262626]">
                  <div className="h-1.5 rounded-full" style={{ width: `${Math.round(c.current.fraction * 100)}%`, background: c.current.color }} />
                </div>
              </>
            ) : (
              <p className="text-sm text-dim">{c.ringsComplete === c.rings.length ? "Complete" : state.week ? "Next ring opening soon" : "Opens on your start day"}</p>
            )}
          </div>
          <Chevron />
        </Link>
      ))}

      {alsoOpen.length > 0 && (
        <>
          <Label>Also in progress <span className="normal-case tracking-normal text-dim">· from your weekly plan</span></Label>
          <div className="grid grid-cols-2 gap-2">
            {alsoOpen.map((c) => (
              <Link key={c.id} href={`/circles/${c.slug}`} className="flex min-h-11 items-center gap-2.5 rounded-xl border border-border bg-card p-2.5">
                <Donut c={c} size={30} />
                <span className="min-w-0">
                  <span className="block truncate text-sm">{c.name}</span>
                  <span className="block text-xs text-dim">{c.current ? `Ring ${c.current.number} · day ${Math.min(c.current.day, 14)}` : `${c.ringsComplete}/${c.rings.length} rings`}</span>
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
              const when = next?.opensOn && daysUntil(state.today, next.opensOn) <= 7
                ? `In ${daysUntil(state.today, next.opensOn)} days` : c.firstPlanWeek ? `Week ${c.firstPlanWeek}` : "Ask Michael";
              return (
                <Link key={c.id} href={`/circles/${c.slug}`} className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card px-1 py-2.5 text-center">
                  <Donut c={c} size={34} />
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
          <Link key={c.id} href={`/circles/${c.slug}`} className="inline-flex min-h-9 items-center rounded-full border border-[#2a2a2a] px-3.5 text-sm">
            {c.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
