import { BLUEPRINT, blueprintLabels } from "@/lib/blueprint";
import Section from "@/components/Section";
import CoachProgress from "@/components/CoachProgress";
import AdminStuff from "@/components/AdminStuff";
import { BadgesCard } from "@/components/ProgressView";
import { loadDaily } from "@/lib/daily";
import PageRecorder from "@/components/PageRecorder";
import OpenOnHash from "@/components/OpenOnHash";
import CoachWorkoutDays from "@/components/CoachWorkoutDays";
import { loadSchedule, loadWorkoutWeek } from "@/lib/workouts";
import { defaultWorkoutDays } from "@/lib/calendar";
import RemoveClient from "@/components/RemoveClient";
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
import { BadgeRow } from "@/components/BadgeIcon";
import { questionLabels } from "@/lib/checkin";
import { adminClient } from "@/lib/supabase/admin";
import { loadSeen } from "@/lib/seen";
import { loadFoodWeek } from "@/lib/food-week";
import FoodWeek from "@/components/FoodWeek";
import SeenStrip, { lastInLabel } from "@/components/SeenStrip";

export default async function CoachClient({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ welcome?: string; r?: string }> }) {
  const { welcome, r: rr } = await searchParams;
  const range = [7, 30, 90, 180, 365].includes(Number(rr)) ? Number(rr) : 30; // November 15: 7 days … 12 months
  const { id } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase.from("profiles").select("*").eq("id", id).single();
  // November 15: plus her own custom programs (hidden from everyone else's list), so saving her details keeps hers.
  const { data: progRows } = await supabase.from("programs").select("id, name, weeks").or(`active.eq.true,id.like.custom-${id.slice(0, 8)}-%`).order("sort").order("name");
  const programs = (progRows ?? []) as { id: string; name: string; weeks: number }[];
  // November 5: her program's weeks, for "Her workouts this week".
  const { data: phRows } = await supabase.from("program_phases").select("name, first_week, weeks").eq("program", (p?.workout_program as string | null) ?? "sltp").order("first_week");
  const phaseWeeks = (phRows ?? []).flatMap((ph) => Array.from({ length: ph.weeks as number }, (_, i) => ({
    pw: (ph.first_week as number) + i, label: `${ph.name}${(ph.weeks as number) > 1 ? ` · week ${i + 1} of ${ph.weeks}` : ""}`,
  })));
  const tweekNow = trainingWeek((p?.program_start as string | null) ?? null, todayIn((p?.timezone as string | null) ?? "America/Los_Angeles"));
  if (!p) notFound();
  // November 15: which workout lands on which day (her current week, or Week 1 before she starts).
  const wkPlan = p.program_start ? await loadWorkoutWeek(supabase, id, Math.max(1, tweekNow)).catch(() => null) : null;
  const wkSchedule = await loadSchedule(supabase, id);
  const { data: wkItems } = wkPlan?.allStrength.length
    ? await supabase.from("workout_items").select("workout_id, position, exercises(name)").in("workout_id", wkPlan.allStrength.map((w) => w.id))
    : { data: [] };
  const planDays = (wkPlan?.allStrength ?? []).map((w) => ({ day: w.day!, title: w.title,
    exercises: ((wkItems ?? []) as unknown as { workout_id: number; position: number; exercises: { name: string } | null }[]).filter((i) => i.workout_id === w.id).sort((a, b) => a.position - b.position).map((i) => i.exercises?.name ?? "").filter(Boolean) }));
  const [state, { data: t }, { data: checkins }, { data: focusRows }, prog, { data: purchases }, { data: assessment }] = await Promise.all([
    loadProgram(supabase, id),
    supabase.from("nutrition_targets").select("maintenance_calories, calorie_target, protein_g, fiber_g, potassium_mg").eq("client_id", id).maybeSingle(),
    supabase.from("checkins").select("id, week_number, sleep, energy, stress, hunger, flags, answers, submitted_at, ai_summary, checkin_replies(sent_at)").eq("client_id", id).order("week_number", { ascending: false }),
    supabase.from("client_focus_circles").select("circle_id").eq("client_id", id),
    progressFor(supabase, id),
    supabase.from("client_purchases").select("id, offer, amount_paid, purchased_on, starts_on, expires_on, notes").eq("client_id", id).order("purchased_on", { ascending: false, nullsFirst: false }),
    supabase.from("assessments").select("answers, ai_summary, submitted_at").eq("client_id", id).maybeSingle(),
  ]);
  // November 15: 6 and 12 months need more days than the usual 90.
  const progData = range > 90 ? await loadDaily(supabase, id, range) : prog.data;
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

  const first = ((p.full_name as string | null) ?? "her").split(" ")[0];
  const lastW = prog.data.weights[prog.data.weights.length - 1] ?? null;
  // November 15: Action items, what needs his attention for her right now.
  const actions: { icon: string; text: string; href: string }[] = [];
  const daysAgo = (d: string) => Math.round((Date.parse(prog.data.today) - Date.parse(d)) / 86_400_000);
  for (const k of checkins ?? []) {
    const sent = Array.isArray(k.checkin_replies) ? k.checkin_replies[0]?.sent_at : (k.checkin_replies as { sent_at?: string } | null)?.sent_at;
    if (k.submitted_at && !sent) actions.push({ icon: "📝", text: `Reply to her ${weekName(k.week_number)} check-in`, href: `/coach/checkins/${k.id}` });
  }
  const bpIn = blueprintDone(assessment?.submitted_at as string | null);
  if (!bpIn && p.status !== "cancelled") actions.push({ icon: "🧭", text: "Her Driven Woman Blueprint isn't done yet", href: `/coach/followups?tab=${Object.keys((assessment?.answers as object) ?? {}).length ? "started" : "not-started"}` });
  if (bpIn && !bpReply?.done_at) actions.push({ icon: "🎥", text: "Send her your Blueprint reply", href: "#assessment" });
  if (lastW && daysAgo(lastW.date) >= 3) actions.push({ icon: "⚖️", text: `No weigh-in for ${daysAgo(lastW.date)} days`, href: "#progress" });
  if (!lastW) actions.push({ icon: "⚖️", text: "No weigh-ins yet", href: "#progress" });
  const foodDays = foodWeek.days.filter((d) => d.meals.length).length;
  if (foodDays < 4) actions.push({ icon: "🍽️", text: `Food logged ${foodDays} of the last 7 days`, href: "#food" });
  const logged14 = prog.data.days.slice(-14).filter((d) => d.meals).length;
  if (!t?.calorie_target && logged14 >= 10) actions.push({ icon: "🎯", text: `Set her calorie target (${logged14} of the last 14 days logged)`, href: "#targets" });
  const seenAt = (p.last_seen_at as string | null) ?? null;
  // eslint-disable-next-line react-hooks/purity -- a server page, rendered fresh on each visit
  const awayH = seenAt ? (Date.now() - Date.parse(seenAt)) / 3_600_000 : 0;
  if (awayH > 48) actions.push({ icon: "👋", text: `Not in the app for ${Math.round(awayH / 24)} days`, href: `/coach/inbox/${id}` });
  for (const x of purchases ?? []) {
    const left = x.expires_on ? Math.round((Date.parse(x.expires_on as string) - Date.parse(prog.data.today)) / 86_400_000) : null;
    if (left !== null && left <= 21 && left >= -14) actions.push({ icon: "💳", text: left < 0 ? `Her plan ended ${-left} days ago` : `Her plan ends in ${left} days`, href: "#details" });
  }
  if (p.birthday) {
    const b = String(p.birthday).slice(5, 10), y = Number(prog.data.today.slice(0, 4));
    const next = [`${y}-${b}`, `${y + 1}-${b}`].map((d) => -daysAgo(d)).find((n) => n >= 0) ?? 999;
    if (next <= 14) actions.push({ icon: "🎂", text: next === 0 ? "Her birthday is today!" : `Her birthday is in ${next} day${next === 1 ? "" : "s"}`, href: `/coach/inbox/${id}` });
  }
  const small = "font-[family-name:var(--font-display)] text-[13px] uppercase tracking-wide";
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
        {/* November 15: start, current and goal weight, bigger (goal in gold). */}
        <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1">
          {p.start_weight_lbs ? <span className="text-[13px] text-dim">Start: <b className="text-[20px] text-text">{p.start_weight_lbs}</b> <span className="text-[16px] text-text">lbs</span></span> : null}
          {lastW ? <span className="text-[13px] text-dim">Current: <b className="text-[20px] text-text">{lastW.lbs}</b> <span className="text-[16px] text-text">lbs</span></span> : null}
          {p.goal_weight_lbs ? <span className="text-[13px] text-dim">Goal: <b className="text-[20px] text-[#e8b84a]">{p.goal_weight_lbs}</b> <span className="text-[16px] font-semibold text-[#e8b84a]">lbs</span></span> : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link href={`/coach/inbox/${id}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#7a7a7a] px-3 text-[13px] font-semibold">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5z" /></svg>Chat
          </Link>
          <SeeHerApp clientId={id} />
          <PageRecorder clientId={id} first={first} />
          <AdminStuff first={first}>
            <WelcomeButton clientId={id} failed={welcome === "failed"} />
            <SignInCodeButton clientId={id} first={first} phone={(p.phone as string | null) ?? null} />
          </AdminStuff>
        </div>
      </header>

      {/* November 15: what needs his attention for her, at a glance. */}
      <Section title="Action items" right={actions.length ? `${actions.length}` : "all clear"}>
        {actions.length ? (
          <ul className="space-y-1.5">
            {actions.map((x, i) => (
              <li key={i}>
                <Link href={x.href} className="flex items-center gap-2.5 rounded-xl border border-border bg-bg/50 px-3 py-2 text-[14px] hover:border-accent">
                  <span aria-hidden="true">{x.icon}</span><span className="min-w-0 flex-1">{x.text}</span><span className="text-dim" aria-hidden="true">›</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-dim">Nothing needs you right now.</p>}
          {toSignOff.length > 0 && (
            <div className="space-y-2">
              <p className={`${small} pt-2`}>Milestones to sign off</p>
              {toSignOff.map(({ c, r, i }) => (
                <div key={i.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <div className="flex-1"><p className="text-xs text-dim">{c.name} · Medal {r.number}</p><p className="text-sm">{i.title}</p></div>
                  <SignOffButton clientId={id} itemId={i.id} />
                </div>
              ))}
            </div>
          )}
        <ThursdayScript clientId={id} />
      </Section>

      {/* November 13: what she's been doing lately, and the flow for a personal message. */}
      <Section title="What she's been up to">
        <BriefPanel bare clientId={id} first={first} phone={(p.phone as string | null) ?? null} />
      </Section>

      {/* Her food, the last 7 days (November 1): tap a day for every meal, swipe between days. */}
      <Section id="food" title="Food - last 7 days"><FoodWeek data={foodWeek} coachClientId={id} title="" /></Section>

      <Section id="progress" title="Her progress">
        <CoachProgress data={progData} range={range} base={`/coach/clients/${id}`} />
        {photos.length > 0 && <ProgressPhotos photos={photos} today={prog.data.today} readOnly />}
      </Section>

      <Section title="Circles">
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
          <div className="space-y-2">
            <p className={`${small} pt-3`}>Focus circles</p>
            <FocusPicker clientId={id} selected={(focusRows ?? []).length ? focusRows!.map((f) => f.circle_id) : state.circles.filter((c) => c.focus).map((c) => c.id)}
              circles={state.circles.filter((c) => c.kind !== "fixit_event").map((c) => ({ id: c.id, name: c.name, counts: true }))} />
          </div>
      </Section>

      <Section id="targets" title="Her targets" open={false}>
        <ProfileForm part="targets" clientId={id} p={p} t={t} />
      </Section>

      <Section id="assessment" title="Assessment">
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
                  {/* November 15: in Blueprint order, each answer under its question (notes say what they're about). */}
                  {(() => {
                    const ans = (assessment?.answers as Record<string, unknown>) ?? {};
                    const val = (v: unknown) => (typeof v === "string" ? v : Array.isArray(v) ? v.join(" · ") : typeof v === "number" ? String(v) : JSON.stringify(v));
                    const has = (v: unknown) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length);
                    const known = new Set(BLUEPRINT.flatMap((sc) => sc.fields.map((f) => f.id)));
                    const groups = BLUEPRINT.map((sc) => ({ sc, rows: sc.fields.filter((f) => has(ans[f.id])) })).filter((g) => g.rows.length);
                    const extra = Object.entries(ans).filter(([k, v]) => !known.has(k) && !["videos", "previous", "assigned"].includes(k) && has(v));
                    return <>
                      {groups.map(({ sc, rows }) => (
                        <div key={sc.key} className="rounded-lg border border-[#242424] bg-bg/50 p-2.5">
                          <dt className="text-[13px] font-semibold text-accent">{sc.title}</dt>
                          <dd className="mt-1 space-y-1">
                            {rows.map((f) => (
                              <div key={f.id}>
                                {(f.kind !== "open" || rows.length > 1) && <span className="block text-xs text-dim">{f.kind === "note" ? `${f.label.replace(/\s*\(optional\)/i, "")} (her note on this)` : f.label}</span>}
                                <span className="whitespace-pre-line">{val(ans[f.id])}</span>
                              </div>
                            ))}
                          </dd>
                        </div>
                      ))}
                      {extra.map(([k, v]) => <div key={k}><dt className="text-xs text-dim">{labels[k] ?? k.replace(/_/g, " ")}</dt><dd className="whitespace-pre-line">{val(v)}</dd></div>)}
                    </>;
                  })()}
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
      </Section>

      <Section title="Check-ins" right={checkins?.length ? `${checkins.length}` : undefined}>
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
      </Section>

      <BadgesCard badges={prog.status} coach />

      <OpenOnHash ids={["details", "targets", "assessment"]} />
      <Section id="details" title="Her details" open={false}>
        <ProfileForm part="details" clientId={id} p={p} t={t} programs={programs} phaseWeeks={phaseWeeks} tweek={tweekNow} />
        <p className={`${small} pt-3`}>15-pound guarantee</p>
        <GuaranteeCard g={guarantee} />
        <p className={`${small} pt-3`}>What she bought</p>
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
      </Section>

      <Section title={`${first}'s workouts`}>
        {wkPlan?.phase ? (<>
          <p className={small}>Her workout week</p>
          <CoachWorkoutDays clientId={id} first={((p.full_name as string | null) ?? "her").split(" ")[0]} schedule={wkSchedule}
          workoutDays={((p.workout_days as number[] | null) ?? []).length ? (p.workout_days as number[]) : defaultWorkoutDays(wkPlan.strength.length)}
          days={planDays} weekLabel={tweekNow >= 1 ? `this week (Week ${tweekNow})` : "Week 1, starts Monday"} programName={wkPlan.program.name} />
        </>) : <p className="text-sm text-dim">Her workouts show here once her program starts.</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <Link href={`/coach/clients/${id}/program`} className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-[13px] font-semibold">{String(p.workout_program ?? "").startsWith("custom-") ? "✎ Her custom program" : "+ Custom program"}</Link>
          <Link href={`/coach/clients/${id}/workouts`} className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-[13px] font-semibold">Her workout history</Link>
        </div>
        <details className="rounded-xl border border-border p-3">
          <summary className="cursor-pointer text-[13px] font-semibold text-accent">Program settings (program, week, days)</summary>
          <div className="mt-3"><ProfileForm part="program" clientId={id} p={p} t={t} programs={programs} phaseWeeks={phaseWeeks} tweek={tweekNow} /></div>
        </details>
      </Section>

      <div id="remove" className="scroll-mt-20">
        <RemoveClient clientId={id} first={first} removed={p.status === "cancelled"} />
      </div>
    </section>
  );
}
