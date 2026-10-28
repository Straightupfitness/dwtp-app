import Link from "next/link";
import WelcomeButton from "./WelcomeButton";
import ThursdayScript from "./ThursdayScript";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadProgram } from "@/lib/circles";
import MedalCircle from "@/components/MedalCircle";
import { ProfileForm, FocusPicker, OpenRingButton, SignOffButton } from "./ClientForms";

export default async function CoachClient({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams;
  const { id } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase.from("profiles").select("*").eq("id", id).single();
  const { data: progRows } = await supabase.from("programs").select("id, name, weeks").eq("active", true).order("sort").order("name");
  const programs = (progRows ?? []) as { id: string; name: string; weeks: number }[];
  if (!p) notFound();
  const [state, { data: t }, { data: checkins }, { data: weights }, { data: focusRows }] = await Promise.all([
    loadProgram(supabase, id),
    supabase.from("nutrition_targets").select("maintenance_calories, calorie_target, protein_g").eq("client_id", id).maybeSingle(),
    supabase.from("checkins").select("id, week_number, sleep, energy, stress, hunger, flags, checkin_replies(sent_at)").eq("client_id", id).order("week_number", { ascending: false }),
    supabase.from("weight_logs").select("log_date, weight_lbs").eq("client_id", id).order("log_date", { ascending: false }).limit(14),
    supabase.from("client_focus_circles").select("circle_id").eq("client_id", id),
  ]);
  const toSignOff = state.circles.flatMap((c) => c.rings.filter((r) => r.status === "open")
    .flatMap((r) => r.items.filter((i) => i.type === "hit" && !i.complete).map((i) => ({ c, r, i }))));
  const visible = state.circles.filter((c) => c.kind === "growth" || c.status === "open");

  return (
    <section className="space-y-6">
      <Link href="/coach" className="inline-flex min-h-11 items-center text-sm text-dim">← Clients</Link>
      <header>
        <p className="text-xs uppercase tracking-[0.15em] text-accent">{state.week ? `Week ${state.week}` : "Not started"} · {p.status}</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl uppercase">{p.full_name || p.email}</h1>
        <p className="text-xs text-dim">{p.email}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <WelcomeButton clientId={id} failed={welcome === "failed"} />
          <a href="#details" className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-[13px] font-semibold">Edit details</a>
        </div>
      </header>

      <ThursdayScript clientId={id} />

      {toSignOff.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm uppercase tracking-widest text-dim">Milestones to sign off</h2>
          {toSignOff.map(({ c, r, i }) => (
            <div key={i.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <div className="flex-1"><p className="text-xs text-dim">{c.name} · Medal {r.number}</p><p className="text-sm">{i.title}</p></div>
              <SignOffButton clientId={id} itemId={i.id} />
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-sm uppercase tracking-widest text-dim">Circles</h2>
        {visible.map((c) => {
          const next = c.rings.find((r) => r.status === "upcoming" || r.status === "locked");
          return (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
              <MedalCircle medals={c.rings.map((r) => r.fraction)} color={c.color} size={40} label={`${c.ringsComplete} of ${c.rings.length} medals`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{c.name}{c.focus ? <span className="text-accent"> · focus</span> : ""}</p>
                <p className="truncate text-xs text-dim">{c.ringsComplete}/{c.rings.length} done{c.current ? ` · Medal ${c.current.number} ${c.current.name}, day ${c.current.day}` : ""}</p>
              </div>
              {next && <OpenRingButton clientId={id} circleId={c.id} label={c.status === "open" ? `Open medal ${next.number}` : c.kind === "growth" ? "Open early" : "Open fix-it"} />}
            </div>
          );
        })}
        <details className="text-sm">
          <summary className="cursor-pointer text-dim">Open a fix-it</summary>
          <div className="mt-2 space-y-2">
            {state.circles.filter((c) => c.kind !== "growth" && c.status !== "open").map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-border p-2.5">
                <span>{c.name}</span><OpenRingButton clientId={id} circleId={c.id} label="Open fix-it" />
              </div>
            ))}
          </div>
        </details>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm uppercase tracking-widest text-dim">Focus circles</h2>
        <FocusPicker clientId={id} selected={(focusRows ?? []).length ? focusRows!.map((f) => f.circle_id) : state.circles.filter((c) => c.focus).map((c) => c.id)}
          circles={state.circles.filter((c) => c.kind !== "fixit_event").map((c) => ({ id: c.id, name: c.name, counts: true }))} />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm uppercase tracking-widest text-dim">Check-ins</h2>
        {(checkins ?? []).map((k) => {
          const sent = Array.isArray(k.checkin_replies) ? k.checkin_replies[0]?.sent_at : (k.checkin_replies as { sent_at?: string } | null)?.sent_at;
          return (
            <Link key={k.id} href={`/coach/checkins/${k.id}`} className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-sm">
              <span>Week {k.week_number} · sleep {k.sleep ?? "–"} · energy {k.energy ?? "–"} · stress {k.stress ?? "–"} · hunger {k.hunger ?? "–"}</span>
              <span className={sent ? "text-[var(--green)]" : "text-accent"}>{sent ? "Replied" : "Reply"}</span>
            </Link>
          );
        })}
        {!checkins?.length && <p className="text-sm text-dim">No check-ins yet.</p>}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm uppercase tracking-widest text-dim">Recent weights</h2>
        <p className="text-sm">{(weights ?? []).map((w) => `${w.log_date.slice(5)}: ${w.weight_lbs}`).join(" · ") || "None yet"}</p>
      </div>

      <div id="details" className="scroll-mt-20 space-y-2">
        <h2 className="text-sm uppercase tracking-widest text-dim">Her details and targets</h2>
        <ProfileForm clientId={id} p={p} t={t} programs={programs} />
      </div>
    </section>
  );
}
