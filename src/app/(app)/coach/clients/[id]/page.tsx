import { blueprintLabels } from "@/lib/blueprint";
import SignInCodeButton from "@/components/SignInCodeButton";
import BlueprintReply from "@/components/BlueprintReply";
import { blueprintDone } from "@/lib/blueprint";
import BriefPanel from "@/components/BriefPanel";
import ProgressPhotos from "@/components/ProgressPhotos";
import { loadProgressPhotos } from "@/lib/progress-photos";
import { todayIn, trainingWeek, weekName } from "@/lib/program";
import Link from "next/link";
import WelcomeButton from "./WelcomeButton";
import SeeHerApp from "./SeeHerApp";
import GuaranteeCard from "./GuaranteeCard";
import { guaranteeFor } from "@/lib/guarantee";
import ThursdayScript from "./ThursdayScript";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadProgram } from "@/lib/circles";
import MedalCircle from "@/components/MedalCircle";
import { ProfileForm, FocusPicker, OpenRingButton, SignOffButton, PurchaseForm, DeletePurchase } from "./ClientForms";
import { progressFor } from "@/lib/badges-server";
import { compliance } from "@/lib/daily";
import ProgressView from "@/components/ProgressView";
import { BadgeRow } from "@/components/BadgeIcon";
import { questionLabels } from "@/lib/checkin";
import { adminClient } from "@/lib/supabase/admin";
import { loadSeen } from "@/lib/seen";
import { loadFoodWeek } from "@/lib/food-week";
import FoodWeek from "@/components/FoodWeek";
import SeenStrip, { lastInLabel } from "@/components/SeenStrip";

export default async function CoachClient({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ welcome?: string; r?: string }> }) {
  const { welcome, r: rr } = await searchParams;
  const range = [14, 30, 90].includes(Number(rr)) ? Number(rr) : 30;
  const { id } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase.from("profiles").select("*").eq("id", id).single();
  const { data: progRows } = await supabase.from("programs").select("id, name, weeks").eq("active", true).order("sort").order("name");
  const programs = (progRows ?? []) as { id: string; name: string; weeks: number }[];
  // November 5: her program's weeks, for "Her workouts this week".
  const { data: phRows } = await supabase.from("program_phases").select("name, first_week, weeks").eq("program", (p?.workout_program as string | null) ?? "sltp").order("first_week");
  const phaseWeeks = (phRows ?? []).flatMap((ph) => Array.from({ length: ph.weeks as number }, (_, i) => ({
    pw: (ph.first_week as number) + i, label: `${ph.name}${(ph.weeks as number) > 1 ? ` · week ${i + 1} of ${ph.weeks}` : ""}`,
  })));
  const tweekNow = trainingWeek((p?.program_start as string | null) ?? null, todayIn((p?.timezone as string | null) ?? "America/Los_Angeles"));
  if (!p) notFound();
  const [state, { data: t }, { data: checkins }, { data: focusRows }, prog, { data: purchases }, { data: assessment }] = await Promise.all([
    loadProgram(supabase, id),
    supabase.from("nutrition_targets").select("maintenance_calories, calorie_target, protein_g, fiber_g, potassium_mg").eq("client_id", id).maybeSingle(),
    supabase.from("checkins").select("id, week_number, sleep, energy, stress, hunger, flags, answers, submitted_at, ai_summary, checkin_replies(sent_at)").eq("client_id", id).order("week_number", { ascending: false }),
    supabase.from("client_focus_circles").select("circle_id").eq("client_id", id),
    progressFor(supabase, id),
    supabase.from("client_purchases").select("id, offer, amount_paid, purchased_on, starts_on, expires_on, notes").eq("client_id", id).order("purchased_on", { ascending: false, nullsFirst: false }),
    supabase.from("assessments").select("answers, ai_summary, submitted_at").eq("client_id", id).maybeSingle(),
  ]);
  const glance = compliance(prog.data);
  const { data: bpReply } = await supabase.from("coach_followups").select("brief, done_at").eq("client_id", id).eq("topic", "blueprint-reply").maybeSingle();
  // November 10: Driven Woman Blueprint labels and video answers.
  const bpLabels = blueprintLabels();
  const assigned = ((assessment?.answers as Record<string, unknown> | null)?.assigned ?? null) as { focus: string[]; fixits: string[]; skipped: string[]; reasons: string[]; at: string } | null;
  const bpPaths = Object.entries(((assessment?.answers as Record<string, unknown> | null)?.videos ?? {}) as Record<string, string>);
  const bpSigned = bpPaths.length ? (await supabase.storage.from("checkin-videos").createSignedUrls(bpPaths.map(([, p]) => p), 3600)).data ?? [] : [];
  const bpVideos = bpPaths.map(([k, path]) => [k, bpSigned.find((x) => x.path === path)?.signedUrl] as [string, string | undefined]).filter((x): x is [string, string] => !!x[1]);
  // November 3: ‹ › to the previous / next client (A–Z, same as the overview).
  const { data: everyone } = await supabase.from("profiles").select("id, full_name, email, status").eq("role", "client").neq("status", "cancelled");
  const order = (everyone ?? []).map((c) => ({ id: c.id as string, name: (c.full_name || c.email || "") as string })).sort((a, b) => a.name.localeCompare(b.name));
  const at = order.findIndex((c) => c.id === id);
  const prevC = order.length > 1 && at >= 0 ? order[(at - 1 + order.length) % order.length] : null;
  const nextC = order.length > 1 && at >= 0 ? order[(at + 1) % order.length] : null;
  const arrow = "grid size-10 shrink-0 place-items-center rounded-full border border-border text-xl text-[#cfcfcf] hover:border-accent hover:text-accent";
  // November 1: when she was last in the app, her last 7 days, and her food for the week.
  const [seenMap, foodWeek, photos] = await Promise.all([
    (async () => {
      try {
        const db = adminClient();
        const { data: u } = await db.auth.admin.getUserById(id);
        const last = [p.last_seen_at as string | null, u?.user?.last_sign_in_at ?? null].filter(Boolean).sort().pop() ?? null;
        return await loadSeen(db, [{ id, timezone: p.timezone, lastSeen: last }]);
      } catch { return null; }
    })(),
    loadFoodWeek(supabase, id),
    loadProgressPhotos(supabase, id), // November 11
  ]);
  const seen = seenMap?.get(id) ?? null;
  const guarantee = await guaranteeFor(supabase, id).catch(() => null);
  const labels = questionLabels();
  const money = (n: number | null) => (n === null ? "–" : `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`);
  const dt = (d: string | null) => (d ? new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "–");
  const expiresIn = (d: string | null) => (d ? Math.round((Date.parse(d) - Date.parse(prog.data.today)) / 86_400_000) : null);
  const earned = prog.status.filter((b) => b.earned).map((b) => b.def.key);
  const toSignOff = state.circles.flatMap((c) => c.rings.filter((r) => r.status === "open")
    .flatMap((r) => r.items.filter((i) => i.type === "hit" && !i.complete).map((i) => ({ c, r, i }))));
  const visible = state.circles.filter((c) => c.kind === "growth" || c.status === "open");

  return (
    <section className="space-y-6">
      <Link href="/coach" className="inline-flex min-h-11 items-center text-sm text-dim">← Clients</Link>
      <header>
        <p className="text-xs uppercase tracking-[0.15em] text-accent">{state.week ? `Week ${state.week}` : p.program_start ? `Starts ${new Date(p.program_start + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}` : "Not started"} · {p.status}</p>
        <div className="flex items-center gap-2">
          {prevC && <Link href={`/coach/clients/${prevC.id}`} className={arrow} aria-label={`Previous client: ${prevC.name}`} title={prevC.name}>‹</Link>}
          <h1 className="min-w-0 font-[family-name:var(--font-display)] text-3xl uppercase">{p.full_name || p.email} <BadgeRow badges={earned} size={22} /></h1>
          {nextC && <Link href={`/coach/clients/${nextC.id}`} className={arrow} aria-label={`Next client: ${nextC.name}`} title={nextC.name}>›</Link>}
        </div>
        <p className="text-xs text-dim">{p.email}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
          <span className="text-dim">Last in the app: <b className="text-text">{lastInLabel(seen)}</b></span>
          <SeenStrip seen={seen} size={18} labels />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <SeeHerApp clientId={id} />
          <WelcomeButton clientId={id} failed={welcome === "failed"} />
          <a href="#details" className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-[13px] font-semibold">Edit details</a>
          <a href="#food" className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-[13px] font-semibold">Food log</a>
          <Link href={`/coach/clients/${id}/workouts`} className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-[13px] font-semibold">Workouts</Link>
          <Link href={`/coach/inbox/${id}`} className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-[13px] font-semibold">Chat</Link>
          <a href="#progress" className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-[13px] font-semibold">Progress</a>
        </div>
      </header>
      {/* November 13: what she's been doing lately, and the flow for a personal message. */}
      <SignInCodeButton clientId={id} first={((p.full_name as string | null) ?? "her").split(" ")[0]} phone={(p.phone as string | null) ?? null} />
      <BriefPanel clientId={id} first={((p.full_name as string | null) ?? "her").split(" ")[0]} phone={(p.phone as string | null) ?? null} />

      <GuaranteeCard g={guarantee} />

      <div className="space-y-2">
        <h2 className="text-sm uppercase tracking-widest text-dim">Check-ins</h2>
        <div className="grid gap-2 lg:grid-cols-2">
        {(checkins ?? []).map((k) => {
          const sent = Array.isArray(k.checkin_replies) ? k.checkin_replies[0]?.sent_at : (k.checkin_replies as { sent_at?: string } | null)?.sent_at;
          return (
            <Link key={k.id} href={`/coach/checkins/${k.id}`} className="block space-y-1 rounded-xl border border-border bg-card p-3 text-sm">
              <span className="flex items-center justify-between gap-2">
                <span><b>{weekName(k.week_number)}</b>{k.submitted_at && <span className="text-dim"> · {new Date(k.submitted_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>}<br className="sm:hidden" /><span className="hidden sm:inline"> · </span>sleep {k.sleep ?? "–"} · energy {k.energy ?? "–"} · stress {k.stress ?? "–"} · hunger {k.hunger ?? "–"}</span>
                <span className={`shrink-0 ${sent ? "text-[var(--green)]" : "text-accent"}`}>{sent ? "Replied" : "Reply"}</span>
              </span>
              {((k.flags as string[] | null) ?? []).length > 0 && <span className="flex flex-wrap gap-1">{(k.flags as string[]).map((f) => <span key={f} className="rounded-full bg-[#2a1218] px-2 py-0.5 text-[11px] text-[#fb7185]">{f}</span>)}</span>}
              {(k.answers as Record<string, unknown> | null)?.win ? <span className="block text-xs text-[#a8a8a8]">Win: {String((k.answers as Record<string, unknown>).win).slice(0, 140)}</span> : null}
              {(k.answers as Record<string, unknown> | null)?.help ? <span className="block text-xs text-[#a8a8a8]">Wants help with: {String((k.answers as Record<string, unknown>).help).slice(0, 140)}</span> : null}
              {(k.answers as Record<string, unknown> | null)?.steps_avg ? <span className="block text-xs text-[#a8a8a8]">Steps: {String((k.answers as Record<string, unknown>).steps_avg)} a day</span> : null}
            </Link>
          );
        })}
        </div>
        {!checkins?.length && <p className="text-sm text-dim">No check-ins yet.</p>}
      </div>

      {/* Her food, the last 7 days (November 1): tap a day for every meal, swipe between days. */}
      <div id="food" className="scroll-mt-20"><FoodWeek data={foodWeek} coachClientId={id} /></div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="space-y-6">
          {/* At a glance (October 29): her last 14 finished days. */}
          <div className="space-y-2">
            <h2 className="text-sm uppercase tracking-widest text-dim">Compliance · last 14 days</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {glance.map((c) => {
                const pct = c.value !== null && c.of ? c.value / c.of : null;
                const tone = pct === null ? "text-dim" : pct >= 0.8 ? "text-[#7ee2a8]" : pct >= 0.5 ? "text-accent" : "text-[#fb7185]";
                return (
                  <div key={c.label} className="rounded-xl border border-border bg-card p-2.5">
                    <p className="text-[11px] uppercase tracking-[0.08em] text-dim">{c.label}</p>
                    <p className={`font-[family-name:var(--font-display)] text-2xl leading-tight ${tone}`}>{c.value === null ? "–" : `${c.value}/${c.of}`}</p>
                    <p className="text-[11px] text-dim">{c.note}</p>
                  </div>
                );
              })}
            </div>
          </div>

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



          <ThursdayScript clientId={id} />

          <div className="space-y-2">
            <h2 className="text-sm uppercase tracking-widest text-dim">What she bought</h2>
            {(purchases ?? []).map((x) => {
              const left = expiresIn(x.expires_on);
              return (
                <div key={x.id} className="rounded-xl border border-border bg-card p-3 text-sm">
                  <div className="flex items-baseline justify-between gap-2"><p className="font-semibold">{x.offer}</p><p className="shrink-0 font-semibold">{money(x.amount_paid)}</p></div>
                  <p className="text-xs text-dim">Bought {dt(x.purchased_on)} · starts {dt(x.starts_on)} · expires {dt(x.expires_on)}
                    {left !== null && <span className={left < 0 ? "text-[#fb7185]" : left <= 21 ? "text-accent" : ""}> ({left < 0 ? `ended ${-left} days ago` : `${left} days left`})</span>}</p>
                  {x.notes && <p className="mt-1 text-xs text-[#a8a8a8]">{x.notes}</p>}
                  <DeletePurchase clientId={id} id={x.id} />
                </div>
              );
            })}
            <details><summary className="cursor-pointer text-sm text-accent">+ Add a purchase</summary><div className="mt-2"><PurchaseForm clientId={id} /></div></details>
          </div>

          {photos.length > 0 && <ProgressPhotos photos={photos} today={prog.data.today} readOnly />}

          <div className="space-y-2">
            <h2 className="text-sm uppercase tracking-widest text-dim">Assessment</h2>
            {/* November 13: his video reply to her Blueprint, with AI talking points on screen while he records. */}
            {blueprintDone(assessment?.submitted_at as string | null) && (
              <BlueprintReply clientId={id} first={((p.full_name as string | null) ?? "her").split(" ")[0]}
                initial={(bpReply?.brief as { groups: { h: string; items: string[] }[]; at: string } | null) ?? null} sentAt={(bpReply?.done_at as string | null) ?? null} />
            )}
            {assessment?.submitted_at || assessment?.ai_summary || Object.keys((assessment?.answers as object) ?? {}).length ? (
              <details id="blueprint" className="scroll-mt-20 rounded-xl border border-border bg-card p-3 text-sm" open>
                <summary className="cursor-pointer font-semibold">Driven Woman Blueprint{assessment?.submitted_at ? ` · ${new Date(assessment.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}</summary>
                {assessment?.ai_summary && <p className="mt-2 whitespace-pre-line text-[#d4d4d4]">{assessment.ai_summary}</p>}
                <dl className="mt-2 space-y-1.5">
                  {Object.entries((assessment?.answers as Record<string, unknown>) ?? {}).filter(([k]) => !["videos", "previous", "assigned"].includes(k)).map(([k, v]) => (
                    <div key={k}><dt className="text-xs text-dim">{bpLabels[k] ?? labels[k] ?? k.replace(/_/g, " ")}</dt><dd className="whitespace-pre-line">{typeof v === "string" ? v : Array.isArray(v) ? v.join(" · ") : JSON.stringify(v)}</dd></div>
                  ))}
                  {/* November 11: what the app picked for her from the Blueprint. */}
                  {assigned && (
                    <div className="rounded-xl border border-accent/50 bg-[#161310] p-3 sm:col-span-2">
                      <dt className="text-xs uppercase tracking-wider text-accent">Picked for her automatically · {new Date(assigned.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</dt>
                      <dd className="mt-1 space-y-1 text-sm">
                        <p><b>Focus:</b> {assigned.focus.join(", ")}</p>
                        {assigned.fixits.length > 0 && <p><b>Fix-its opened:</b> {assigned.fixits.join(", ")}</p>}
                        {assigned.skipped.length > 0 && <p><b>Already doing (marked done):</b> {assigned.skipped.join("; ")}</p>}
                        {assigned.reasons.length > 0 && <p className="text-dim">Why: {assigned.reasons.join(" · ")}</p>}
                        <p className="text-xs text-dim">Change any of it under Circles and Focus circles below.</p>
                      </dd>
                    </div>
                  )}
                  {/* November 10: her video answers from the Blueprint. */}
                  {bpVideos.map(([k, url]) => (
                    <div key={k}><dt className="text-xs text-dim">{bpLabels[k] ?? k} (video)</dt><dd><video src={url} controls playsInline preload="metadata" className="mt-1 max-h-[420px] rounded-xl bg-black" /></dd></div>
                  ))}
                </dl>
              </details>
            ) : <p className="text-sm text-dim">No assessment in the app yet. Your onboarding notes are under Edit details.</p>}
            {p.coach_notes && <p className="whitespace-pre-line rounded-xl border border-border p-3 text-sm text-[#d4d4d4]"><span className="block text-xs text-dim">Your notes</span>{p.coach_notes}</p>}
          </div>
        </div>
        <div className="space-y-6">
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
        </div>
      </div>

      <div id="progress" className="scroll-mt-20 space-y-2">
        <h2 className="text-sm uppercase tracking-widest text-dim">Progress</h2>
        <ProgressView data={prog.data} badges={prog.status} range={range} base={`/coach/clients/${id}`} coach />
      </div>

      <div id="details" className="scroll-mt-20 space-y-2">
        <h2 className="text-sm uppercase tracking-widest text-dim">Her details and targets</h2>
        <ProfileForm clientId={id} p={p} t={t} programs={programs} phaseWeeks={phaseWeeks} tweek={tweekNow} />
      </div>
    </section>
  );
}
