import { weekName } from "@/lib/program";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { weekData } from "@/lib/coach-data";
import { questionLabels } from "@/lib/checkin";
import ReplyEditor from "./ReplyEditor";
import { loadBadWeeks } from "@/lib/bad-weeks";
import { loadDaily } from "@/lib/daily";
import { loadFoodWeek } from "@/lib/food-week";
import FoodWeek from "@/components/FoodWeek";
import WeightDots from "@/components/WeightDots";
import DailyCombo from "@/components/DailyCombo";
import { BAD_WEEK_SCREEN, screensFor } from "@/lib/checkin-screens";
import TranscribeButton from "./TranscribeButton";

export const maxDuration = 120;

const SCORES = ["sleep", "energy", "stress", "hunger"] as const;

export default async function CheckinReview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: c } = await supabase.from("checkins").select("*, checkin_replies(*)").eq("id", id).single();
  if (!c) notFound();
  const reply = (Array.isArray(c.checkin_replies) ? c.checkin_replies[0] : c.checkin_replies) as
    { ai_draft?: string; final_text?: string; video_path?: string; sent_at?: string } | null;

  const [d, { data: baseline }, daily] = await Promise.all([
    weekData(supabase, c.client_id, c.week_number),
    supabase.from("checkins").select("sleep, energy, stress, hunger").eq("client_id", c.client_id).order("week_number").limit(1).maybeSingle(),
    loadDaily(supabase, c.client_id, 60),
  ]);
  // November 1: everything Michael used to have open in Trainerize next to VideoAsk, on this one screen.
  const foodWeek = await loadFoodWeek(supabase, c.client_id, { end: d.end });
  const badWeeks = await loadBadWeeks(supabase, c.client_id); // November 6
  const weights60 = daily.weights.filter((w) => w.date >= daily.days[0].date);
  const firstW = weights60[0], lastW = weights60[weights60.length - 1];
  const last = d.previous[0] ?? null;
  const sleepShots = ((c.answers?.sleep_photos ?? []) as string[]);
  // November 10: a video can come with any answer in the new check-in.
  const answerVideos = ((c.answers?.videos ?? {}) as Record<string, string>);
  const paths = [c.video_path, reply?.video_path, ...sleepShots, ...Object.values(answerVideos)].filter(Boolean) as string[];
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from("checkin-videos").createSignedUrls(paths, 3600);
    data?.forEach((x) => x.path && x.signedUrl && signed.set(x.path, x.signedUrl));
  }
  const labels = questionLabels();
  const answerMap = (c.answers ?? {}) as Record<string, unknown>;
  const answerKeys = [...new Set([...Object.keys(answerMap), ...Object.keys(answerVideos)])]
    .filter((k) => !SCORES.includes(k as never) && !["habits", "sleep_photos", "videos"].includes(k));
  const answers = answerKeys.map((k) => [k, answerMap[k]] as [string, unknown]);
  const habits = ((c.answers?.habits ?? []) as { title: string; status: string; note?: string }[]);

  // November 20 (Michael): one column, top to bottom: her answers in the order she was asked, her graphs, her 7 days
  // of food (empty days show 0), her workouts, then the talking points and his reply. "Record yourself" floats.
  const screens = [...(answerMap.bad_week_story !== undefined ? [BAD_WEEK_SCREEN] : []), ...screensFor(c.week_number)];
  const shown = new Set<string>();
  const val = (id: string) => (answerMap[id] !== undefined ? answerMap[id] : (c as Record<string, unknown>)[id]);
  const fmtAnswer = (v: unknown) => (Array.isArray(v) ? v.join(" · ") : v === null || v === undefined ? "" : String(v));
  const leftover = answers.filter(([k]) => !screens.some((sc) => sc.fields.some((f) => f.id === k)));
  const combo = daily.days.slice(-28);
  const workouts = await loadWeekWorkouts(supabase, c.client_id, d.start, d.end);

  return (
    <section className="mx-auto max-w-5xl space-y-5 pb-32">
      <Link href="/coach" className="inline-flex min-h-11 items-center text-sm text-dim">← Clients</Link>
      <header>
        <p className="text-xs uppercase tracking-[0.15em] text-accent">{weekName(c.week_number)} check-in{badWeeks.includes(c.week_number) ? " · BAD WEEK PLAN" : ""}{d.dietBreak ? " · diet break" : ""}{d.checkinType && d.checkinType !== "standard" ? ` · ${d.checkinType.replace("_", " ")}` : ""}</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl uppercase">
          <Link href={`/coach/clients/${c.client_id}`}>{d.profile?.full_name ?? "Client"}</Link>
        </h1>
        <p className="text-xs text-dim">Sent {new Date(c.submitted_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles", weekday: "short", hour: "numeric", minute: "2-digit" })}</p>
      </header>
      {!!(c.flags as string[])?.length && (
        <div className="flex flex-wrap gap-1.5">{(c.flags as string[]).map((f) => <span key={f} className="rounded bg-[#2a1a10] px-2 py-0.5 text-xs text-gold">{f}</span>)}</div>
      )}

      {/* 1. Her check-in, question by question */}
      <div className="space-y-3 rounded-[18px] border border-border bg-card p-4">
        <h2 className="font-[family-name:var(--font-display)] text-lg uppercase">Her check-in</h2>
        <ol className="space-y-3">
          {screens.map((sc) => {
            if (sc.habits) return habits.length ? (
              <li key={sc.key} className="border-t border-border pt-3 first:border-0 first:pt-0">
                <p className="text-[13px] font-semibold text-accent">{sc.title}</p>
                <ul className="mt-1 text-[15px]">{habits.map((h) => <li key={h.title}>{h.status === "done" ? "✓" : h.status === "partly" ? "◐" : "○"} {h.title}{h.note ? <span className="text-dim"> · {h.note}</span> : null}</li>)}</ul>
              </li>
            ) : null;
            const rows = sc.fields.filter((f) => { const v = val(f.id); return (v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length)) || answerVideos[f.id]; });
            if (!rows.length) return null;
            return (
              <li key={sc.key} className="border-t border-border pt-3 first:border-0 first:pt-0">
                <p className="text-[13px] font-semibold text-accent">{sc.title}</p>
                {rows.map((f) => {
                  shown.add(f.id);
                  const v = val(f.id);
                  const score = SCORES.includes(f.id as never) ? f.id as (typeof SCORES)[number] : null;
                  const prev = score ? last?.[score] ?? null : null, base = score ? baseline?.[score] ?? null : null;
                  return (
                    <div key={f.id} className="mt-1">
                      {sc.fields.length > 1 && <p className="text-[12px] text-dim">{f.label}</p>}
                      {score ? (
                        <p className="text-[15px]"><b className="font-[family-name:var(--font-display)] text-2xl">{String(v ?? "–")}</b><span className="text-dim">/10</span>
                          <span className="ml-2 text-[12px] text-dim">{prev !== null && typeof v === "number" ? `${v - prev > 0 ? "+" : ""}${v - prev} vs last week` : "first check-in"}{base && base !== v ? ` · started at ${base}` : ""}</span></p>
                      ) : fmtAnswer(v) && <p className="whitespace-pre-line text-[15px]">{fmtAnswer(v)}</p>}
                      {answerVideos[f.id] && signed.get(answerVideos[f.id]) && <video src={signed.get(answerVideos[f.id])} controls playsInline preload="metadata" className="mt-1 max-h-[420px] rounded-xl bg-black" />}
                    </div>
                  );
                })}
              </li>
            );
          })}
          {leftover.filter(([k]) => !shown.has(k)).map(([k, v]) => (
            <li key={k} className="border-t border-border pt-3">
              <p className="text-[13px] font-semibold text-accent">{labels[k] ?? k}</p>
              {fmtAnswer(v) && <p className="whitespace-pre-line text-[15px]">{fmtAnswer(v)}</p>}
              {answerVideos[k] && signed.get(answerVideos[k]) && <video src={signed.get(answerVideos[k])} controls playsInline preload="metadata" className="mt-1 max-h-[420px] rounded-xl bg-black" />}
            </li>
          ))}
        </ol>
        {sleepShots.length > 0 && (
          <div className="flex gap-2 overflow-x-auto border-t border-border pt-3">
            {sleepShots.map((sp) => signed.get(sp) && (
              <a key={sp} href={signed.get(sp)} target="_blank" rel="noopener noreferrer" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed link */}
                <img src={signed.get(sp)} alt="Her sleep screenshot" className="h-56 rounded-xl border border-border object-contain" />
              </a>
            ))}
          </div>
        )}
        {c.video_path && signed.get(c.video_path) && !Object.values(answerVideos).includes(c.video_path) && (
          <video src={signed.get(c.video_path)} controls playsInline className="w-full rounded-xl bg-black" />
        )}
        {c.video_path && (c.transcript
          ? <details className="rounded-xl border border-border p-3"><summary className="cursor-pointer text-sm text-dim">Transcript of her video</summary><p className="mt-2 whitespace-pre-line text-[15px]">{c.transcript}</p></details>
          : <div className="flex items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm">
              <span className="text-dim">{c.transcript_status === "pending" ? "Transcribing her video…" : c.transcript_status === "failed" ? "The transcript failed (is DEEPGRAM_API_KEY set in Vercel?)." : "No transcript yet."}</span>
              <TranscribeButton checkinId={c.id} label={c.transcript_status === "pending" ? "Check again" : "Transcribe"} />
            </div>)}
      </div>

      {/* 2. Her graphs */}
      <div className="space-y-3 rounded-[18px] border border-border bg-card p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg uppercase">Weight · 60 days</h2>
          {firstW && lastW && firstW !== lastW && <span className={`text-[13px] font-semibold ${lastW.lbs < firstW.lbs ? "text-[#7ee2a8]" : "text-[#a8a8a8]"}`}>{lastW.lbs < firstW.lbs ? "−" : "+"}{Math.abs(Math.round((lastW.lbs - firstW.lbs) * 10) / 10)} lbs</span>}
        </div>
        <p className="text-[13px] text-[#a8a8a8]">{d.weekWeights.length}/7 weigh-ins this week{lastW ? <> · latest <b className="text-text">{lastW.lbs} lbs</b></> : ""}{d.profile?.goal_weight_lbs ? ` · goal ${d.profile.goal_weight_lbs}` : ""}</p>
        <WeightDots points={weights60} goal={daily.goals.goalWeight} />
      </div>
      <div className="space-y-3 rounded-[18px] border border-border bg-card p-4">
        <h2 className="font-[family-name:var(--font-display)] text-lg uppercase">Calories, protein, fiber, potassium, water, steps · 28 days</h2>
        <DailyCombo days={combo} goals={daily.goals} />
        <p className="text-[11px] text-dim">Solid = hit the target · faded = under it · red = over her calories · a gray dash = nothing logged that day.</p>
      </div>

      {/* 3. Her 7 days of food (days with nothing logged show 0) */}
      <div className="rounded-[18px] border border-border bg-card p-4">
        <FoodWeek data={foodWeek} title="Food · her check-in week" coachClientId={c.client_id} />
      </div>

      {/* 4. Her workouts that week */}
      <div className="space-y-2 rounded-[18px] border border-border bg-card p-4">
        <h2 className="font-[family-name:var(--font-display)] text-lg uppercase">Workouts · her check-in week <span className="text-[13px] normal-case text-dim">{workouts.filter((w) => w.sessions.length).length} of 7 days</span></h2>
        <ul className="divide-y divide-border">
          {workouts.map((w) => (
            <li key={w.date} className="py-2">
              <p className="text-[13px]"><b>{new Date(w.date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}</b>
                {!w.sessions.length && <span className="text-dim"> · no workout logged</span>}</p>
              {w.sessions.map((sn) => (
                <div key={sn.id} className="mt-1 rounded-lg bg-[#141414] p-2">
                  <p className="text-[14px] font-semibold">{sn.name}{sn.minutes ? <span className="font-normal text-dim"> · {sn.minutes} min</span> : null}{!sn.done && <span className="font-normal text-accent"> · not finished</span>}</p>
                  <ul className="mt-0.5 space-y-0.5 text-[13px] text-[#cfcfcf]">
                    {sn.exercises.map((x, k) => <li key={k}><span className="text-text">{x.name}</span><span className="text-dim"> · {x.sets.join(" · ")}</span></li>)}
                    {!sn.exercises.length && <li className="text-dim">No sets logged</li>}
                  </ul>
                </div>
              ))}
            </li>
          ))}
        </ul>
      </div>

      {/* 5. Talking points and his reply */}
      <div className="rounded-[18px] border border-[#3a3020] bg-card p-4">
        <ReplyEditor checkinId={c.id} clientId={c.client_id} initialText={reply?.final_text ?? ""} initialDraft={reply?.ai_draft ?? ""}
          initialSummary={(c.ai_summary as never) ?? null} videoUrl={reply?.video_path ? signed.get(reply.video_path) ?? null : null} sentAt={reply?.sent_at ?? null} />
      </div>
    </section>
  );
}

/** November 20: her workouts day by day for the check-in week (every day listed, even with none). */
async function loadWeekWorkouts(supabase: Awaited<ReturnType<typeof createClient>>, clientId: string, start: string, end: string) {
  const addDay = (x: string, n: number) => new Date(Date.parse(x + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
  const { data: tzRow } = await supabase.from("profiles").select("timezone").eq("id", clientId).single();
  const tz = (tzRow?.timezone as string | null) ?? "America/Los_Angeles";
  const { data } = await supabase.from("workout_sessions")
    .select("id, started_at, completed_at, workouts(name), set_logs(position, set_no, reps, weight, seconds, note, exercises(name))")
    .eq("client_id", clientId).gte("started_at", addDay(start, -1) + "T00:00:00Z").lt("started_at", addDay(end, 2) + "T00:00:00Z").order("started_at");
  type S = { id: string; started_at: string; completed_at: string | null; workouts: { name: string } | null; set_logs: { position: number; set_no: number; reps: number | null; weight: number | null; seconds: number | null; note: string | null; exercises: { name: string } | null }[] };
  const local = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: tz });
  const sessions = ((data ?? []) as unknown as S[]).map((sn) => {
    const byPos = new Map<number, { name: string; sets: string[] }>();
    for (const l of [...sn.set_logs].sort((a, b) => a.position - b.position || a.set_no - b.set_no)) {
      if (!byPos.has(l.position)) byPos.set(l.position, { name: l.exercises?.name?.replace(/\s*\((SLTP|PSR|SLF|DWTP)\)\s*$/i, "") ?? "Exercise", sets: [] });
      const t = [l.weight != null ? `${+l.weight} lb` : null, l.reps != null ? `${l.reps} reps` : null, l.seconds ? `${Math.floor(l.seconds / 60)}:${String(l.seconds % 60).padStart(2, "0")}` : null, l.note].filter(Boolean).join(" × ");
      byPos.get(l.position)!.sets.push(t || "done");
    }
    const m = sn.completed_at ? (Date.parse(sn.completed_at) - Date.parse(sn.started_at)) / 60000 : 0;
    return { id: sn.id, date: local(sn.started_at), name: sn.workouts?.name ?? "Workout", done: !!sn.completed_at, minutes: m > 0 && m < 600 ? Math.round(m) : null, exercises: [...byPos.values()] };
  });
  return Array.from({ length: 7 }, (_, k) => addDay(start, k)).filter((x) => x <= end).map((date) => ({ date, sessions: sessions.filter((sn) => sn.date === date) }));
}
