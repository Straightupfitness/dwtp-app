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
import { DayBars, WeightLine } from "@/components/Charts";
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
  const steps28 = daily.days.slice(-28);
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
  const logged = d.days.filter((x) => x.meals > 0);
  const avg = (k: "calories" | "protein") => logged.length ? Math.round(logged.reduce((s, x) => s + x[k], 0) / logged.length) : null;
  const name = d.profile?.full_name?.split(" ")[0] ?? "Client";

  return (
    <section className="space-y-5">
      <Link href="/coach" className="inline-flex min-h-11 items-center text-sm text-dim">← Clients</Link>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(340px,0.95fr)] xl:items-start">
      <div className="space-y-5">
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

      <div className="grid grid-cols-4 gap-2">
        {SCORES.map((k) => {
          const now = c[k] as number | null, prev = last?.[k] ?? null, base = baseline?.[k] ?? null;
          const diff = now && prev ? now - prev : null;
          return (
            <div key={k} className="rounded-xl border border-border bg-card p-2 text-center">
              <p className="text-[11px] uppercase tracking-wider text-dim">{k}</p>
              <p className="font-[family-name:var(--font-display)] text-2xl">{now ?? "–"}</p>
              <p className="text-[11px] text-dim">{diff !== null ? `${diff > 0 ? "+" : ""}${diff} vs last` : "first"}{base && base !== now ? ` · base ${base}` : ""}</p>
            </div>
          );
        })}
      </div>

      {sleepShots.length > 0 && (
        <div className="space-y-1"><p className="text-sm text-dim">Her sleep screenshots</p>
          <div className="flex gap-2 overflow-x-auto">
            {sleepShots.map((p) => signed.get(p) && (
              <a key={p} href={signed.get(p)} target="_blank" rel="noopener noreferrer" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed link */}
                <img src={signed.get(p)} alt="Her sleep screenshot" className="h-56 rounded-xl border border-border object-contain" />
              </a>
            ))}
          </div>
        </div>
      )}
      {c.video_path && signed.get(c.video_path) && !Object.values(answerVideos).includes(c.video_path) && (
        <div className="space-y-1"><p className="text-sm text-dim">Her video</p>
          <video src={signed.get(c.video_path)} controls playsInline className="w-full rounded-xl bg-black" /></div>
      )}
      {c.video_path && (
        c.transcript ? (
          <details className="rounded-xl border border-border bg-card p-3">
            <summary className="cursor-pointer text-sm uppercase tracking-widest text-dim">Transcript</summary>
            <p className="mt-2 whitespace-pre-line text-[15px]">{c.transcript}</p>
          </details>
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 text-sm">
            <span className="text-dim">{c.transcript_status === "pending" ? "Transcribing her video…" : c.transcript_status === "failed" ? "The transcript failed (is DEEPGRAM_API_KEY set in Vercel?)." : "No transcript yet."}</span>
            <TranscribeButton checkinId={c.id} label={c.transcript_status === "pending" ? "Check again" : "Transcribe"} />
          </div>
        )
      )}

      <div className="space-y-3">
        {answers.map(([k, v]) => (
          <div key={k} className="space-y-1"><p className="text-xs uppercase tracking-wider text-dim">{labels[k] ?? k}</p>
            {v !== undefined && v !== "" && <p className="whitespace-pre-line">{Array.isArray(v) ? v.join(" · ") : String(v)}</p>}
            {answerVideos[k] && signed.get(answerVideos[k]) && <video src={signed.get(answerVideos[k])} controls playsInline preload="metadata" className="max-h-[480px] rounded-xl bg-black" />}
          </div>
        ))}
        {habits.length > 0 && (
          <div><p className="text-xs uppercase tracking-wider text-dim">This week&apos;s new habits</p>
            <ul className="text-sm">{habits.map((h) => <li key={h.title}>{h.status === "done" ? "✓" : h.status === "partly" ? "◐" : "○"} {h.title}{h.note ? <span className="text-dim"> · {h.note}</span> : null}</li>)}</ul>
          </div>
        )}
      </div>

      </div>

      {/* Her numbers: weight, steps and food, like Trainerize next to VideoAsk. */}
      <div className="space-y-5">
        <div className="space-y-2 rounded-[18px] border border-border bg-card p-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm uppercase tracking-widest text-dim">Weight · 60 days</h2>
            {firstW && lastW && firstW !== lastW && <span className={`text-[13px] font-semibold ${lastW.lbs < firstW.lbs ? "text-[#7ee2a8]" : "text-[#a8a8a8]"}`}>{lastW.lbs < firstW.lbs ? "−" : "+"}{Math.abs(Math.round((lastW.lbs - firstW.lbs) * 10) / 10)} lbs</span>}
          </div>
          <p className="text-[13px] text-[#a8a8a8]">{d.weekWeights.length}/7 weigh-ins this week{lastW ? <> · latest <b className="text-text">{lastW.lbs} lbs</b> on {new Date(lastW.date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}</> : ""}{d.profile?.goal_weight_lbs ? ` · goal ${d.profile.goal_weight_lbs}` : ""}</p>
          <WeightLine points={weights60} goal={daily.goals.goalWeight} />
          {d.weekWeights.length > 0 && <p className="text-[12px] text-dim">This week: {d.weekWeights.map((w) => `${new Date(w.log_date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })} ${w.weight_lbs}`).join(" · ")}</p>}
        </div>
        <div className="space-y-2 rounded-[18px] border border-border bg-card p-3">
          <h2 className="text-sm uppercase tracking-widest text-dim">Steps · 28 days</h2>
          {steps28.some((x) => x.steps)
            ? <DayBars days={steps28.map((x) => ({ date: x.date, value: x.steps }))} color="#a3e635" unit="steps" goal={daily.goals.steps} />
            : <p className="text-[13px] text-dim">No steps synced.{(c.answers as Record<string, unknown> | null)?.steps_avg ? ` She reported ${String((c.answers as Record<string, unknown>).steps_avg)} a day in her check-in.` : ""}</p>}
        </div>
        <FoodWeek data={foodWeek} title="Food · her check-in week" compact coachClientId={c.client_id} />
      <details className="rounded-xl border border-border bg-card p-3">
        <summary className="cursor-pointer text-sm uppercase tracking-widest text-dim">{name}&apos;s week in numbers</summary>
        <div className="mt-3 space-y-3 text-sm">
          <p><b>Weight:</b> {d.lastWeight ? `${d.lastWeight.weight_lbs} lbs on ${d.lastWeight.log_date}` : "none logged in 3 weeks"} · {d.weekWeights.length}/7 weigh-ins this week
            {d.profile?.start_weight_lbs ? ` · start ${d.profile.start_weight_lbs}` : ""}{d.profile?.goal_weight_lbs ? ` · goal ${d.profile.goal_weight_lbs}` : ""}</p>
          <p><b>Food:</b> {logged.length}/7 days logged{avg("calories") !== null ? ` · avg ${avg("calories")} kcal, ${avg("protein")} g protein` : ""}
            {d.target?.calorie_target ? ` · target ${d.target.calorie_target}` : " · no calorie target yet"}</p>
          <table className="w-full text-xs">
            <thead className="text-dim"><tr><th className="text-left font-normal">Day</th><th className="font-normal">Meals</th><th className="font-normal">kcal</th><th className="font-normal">Protein</th><th className="font-normal">Fiber</th></tr></thead>
            <tbody>{d.days.map((x) => (
              <tr key={x.date} className={x.meals ? "" : "text-dim"}>
                <td>{new Date(x.date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric", timeZone: "UTC" })}</td>
                <td className="text-center">{x.meals || "–"}</td><td className="text-center">{x.meals ? x.calories : "–"}</td>
                <td className="text-center">{x.meals ? `${x.protein} g` : "–"}</td><td className="text-center">{x.meals ? `${x.fiber} g` : "–"}</td>
              </tr>))}</tbody>
          </table>
          <p><b>Medals open:</b> {d.openRings.join(" · ") || "none"}</p>
        </div>
      </details>

      </div>

      <div className="space-y-3 xl:sticky xl:top-[72px] xl:max-h-[calc(100dvh-90px)] xl:overflow-y-auto">
      <ReplyEditor checkinId={c.id} clientId={c.client_id} initialText={reply?.final_text ?? ""} initialDraft={reply?.ai_draft ?? ""}
        initialSummary={(c.ai_summary as never) ?? null} videoUrl={reply?.video_path ? signed.get(reply.video_path) ?? null : null} sentAt={reply?.sent_at ?? null} />
      </div>
      </div>
    </section>
  );
}
