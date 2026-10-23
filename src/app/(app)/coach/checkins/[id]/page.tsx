import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { weekData } from "@/lib/coach-data";
import { questionLabels } from "@/lib/checkin";
import ReplyEditor from "./ReplyEditor";
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

  const [d, { data: baseline }] = await Promise.all([
    weekData(supabase, c.client_id, c.week_number),
    supabase.from("checkins").select("sleep, energy, stress, hunger").eq("client_id", c.client_id).order("week_number").limit(1).maybeSingle(),
  ]);
  const last = d.previous[0] ?? null;
  const paths = [c.video_path, reply?.video_path].filter(Boolean) as string[];
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from("checkin-videos").createSignedUrls(paths, 3600);
    data?.forEach((x) => x.path && x.signedUrl && signed.set(x.path, x.signedUrl));
  }
  const labels = questionLabels();
  const answers = Object.entries((c.answers ?? {}) as Record<string, unknown>).filter(([k]) => !SCORES.includes(k as never) && k !== "habits");
  const habits = ((c.answers?.habits ?? []) as { title: string; status: string; note?: string }[]);
  const logged = d.days.filter((x) => x.meals > 0);
  const avg = (k: "calories" | "protein") => logged.length ? Math.round(logged.reduce((s, x) => s + x[k], 0) / logged.length) : null;
  const name = d.profile?.full_name?.split(" ")[0] ?? "Client";

  return (
    <section className="space-y-5">
      <Link href="/coach" className="inline-flex min-h-11 items-center text-sm text-dim">← Clients</Link>
      <header>
        <p className="text-xs uppercase tracking-[0.15em] text-accent">Week {c.week_number} check-in{d.dietBreak ? " · diet break" : ""}{d.checkinType && d.checkinType !== "standard" ? ` · ${d.checkinType.replace("_", " ")}` : ""}</p>
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

      {c.video_path && signed.get(c.video_path) && (
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
          <div key={k}><p className="text-xs uppercase tracking-wider text-dim">{labels[k] ?? k}</p><p className="whitespace-pre-line">{String(v)}</p></div>
        ))}
        {habits.length > 0 && (
          <div><p className="text-xs uppercase tracking-wider text-dim">This week&apos;s new habits</p>
            <ul className="text-sm">{habits.map((h) => <li key={h.title}>{h.status === "done" ? "✓" : h.status === "partly" ? "◐" : "○"} {h.title}{h.note ? <span className="text-dim"> · {h.note}</span> : null}</li>)}</ul>
          </div>
        )}
      </div>

      <details className="rounded-xl border border-border bg-card p-3" open>
        <summary className="cursor-pointer text-sm uppercase tracking-widest text-dim">{name}&apos;s week in data</summary>
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

      <ReplyEditor checkinId={c.id} clientId={c.client_id} initialText={reply?.final_text ?? ""} initialDraft={reply?.ai_draft ?? ""}
        initialSummary={(c.ai_summary as never) ?? null} videoUrl={reply?.video_path ? signed.get(reply.video_path) ?? null : null} sentAt={reply?.sent_at ?? null} />
    </section>
  );
}
