import { BAD_WEEK_LIMIT, loadBadWeeks } from "@/lib/bad-weeks";
import { weekName } from "@/lib/program";
import { createClient } from "@/lib/supabase/server";
import { currentWindow } from "@/lib/checkin";
import { screensFor } from "@/lib/checkin-screens";
import { loadVideos } from "@/lib/videos";
import { loadProgram } from "@/lib/circles";
import type { NewHabit } from "./CheckinForm";
import CheckinFlow from "./CheckinFlow";
import BackButton from "@/components/BackButton";

export const maxDuration = 120;

function timeLeft(until: Date) {
  const mins = Math.max(0, Math.round((until.getTime() - Date.now()) / 60_000));
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60);
  return d ? `${d} day${d > 1 ? "s" : ""} ${h} hrs left` : h ? `${h} hrs left` : `${mins} min left`;
}

/** A check-in time in her own time zone ("Friday, Oct 30, 12:00 AM EDT"). */
const fmtIn = (tz: string) => (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(d);
const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);

export default async function CheckinPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const badWeeks = await loadBadWeeks(supabase, user!.id); // November 6: the Bad Week Plan
  const { data: profile } = await supabase.from("profiles").select("program_start, plan, timezone").eq("id", user!.id).single();
  const myTz = profile?.timezone ?? "America/Los_Angeles";
  const fmt = fmtIn(myTz);
  const { open, next } = currentWindow(profile?.program_start ?? null);

  const { data: history } = await supabase.from("checkins")
    .select("id, week_number, submitted_at, checkin_replies(final_text, video_path, sent_at)")
    .eq("client_id", user!.id).order("week_number", { ascending: false });
  const thisOne = open ? history?.find((c) => c.week_number === open.week) : null;
  const { data: prev } = open ? await supabase.from("checkins").select("sleep, energy, stress, hunger").eq("client_id", user!.id)
    .lt("week_number", open.week).order("week_number", { ascending: false }).limit(1).maybeSingle() : { data: null };
  const lastScores = prev as Record<string, number | null> | null;

  const replyVideos = new Map<string, string>();
  const paths = (history ?? []).flatMap((c) => {
    const r = (Array.isArray(c.checkin_replies) ? c.checkin_replies[0] : c.checkin_replies) as { video_path?: string | null; sent_at?: string | null } | null;
    return r?.sent_at && r.video_path ? [r.video_path] : [];
  });
  if (paths.length) {
    const { data } = await supabase.storage.from("checkin-videos").createSignedUrls(paths, 3600);
    data?.forEach((d) => d.path && d.signedUrl && replyVideos.set(d.path, d.signedUrl));
  }

  let form = null;
  if (open && !thisOne && profile?.program_start) {
    const [state, videos] = await Promise.all([loadProgram(supabase, user!.id), loadVideos(supabase, "CHK")]);
    const weekStart = addDays(profile.program_start, (open.week - 1) * 7);
    const weekEnd = addDays(weekStart, 6);
    const habits: NewHabit[] = [];
    for (const c of state.circles) for (const r of c.rings) {
      if (r.status !== "open" || !r.opensOn || r.opensOn < weekStart || r.opensOn > weekEnd) continue;
      const elapsed = Math.max(1, Math.round((Date.parse(state.today) - Date.parse(r.opensOn)) / 86_400_000) + 1);
      for (const i of r.items) {
        if (!["do", "eat", "take"].includes(i.type) || habits.some((x) => x.id === i.id)) continue;
        const prefill = i.complete || i.progress >= Math.min(elapsed, 7) ? "done" : i.progress > 0 || i.doneNow ? "partly" : "not_yet";
        habits.push({ id: i.id, title: i.title, circle: `${c.name} · ${r.name}`, color: r.color, prefill });
      }
    }
    // November 10: the VideoAsk-style check-in, one question per screen with Michael's video.
    form = (
      <CheckinFlow week={open.week} userId={user!.id} habits={habits}
        screens={screensFor(open.week, { onFullYear: profile.plan === "52_weeks" })}
        videos={Object.fromEntries([...videos.values()].map((v) => [v.code, v.url]))}
        circles={state.circles.filter((c) => c.kind === "growth").map((c) => c.name)}
        badWeek={{ already: badWeeks.includes(open.week), left: Math.max(0, BAD_WEEK_LIMIT - badWeeks.length) }}
        closes={new Intl.DateTimeFormat("en-US", { timeZone: myTz, weekday: "short", hour: "numeric", timeZoneName: "short" }).format(open.closes)}
        timeLeft={timeLeft(open.closes)} last={lastScores} />
    );
  }

  return (
    <section className="space-y-6">
      <BackButton fallback="/today" />
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Weekly check-in{form ? " · +10 CPs" : ""}</p>
        {!form && <h1 className="mt-1 font-[family-name:var(--font-display)] text-[30px] font-semibold uppercase">{open ? `Week ${open.week} check-in` : "Check-in"}</h1>}
      </header>

      {form}
      {open && thisOne && <p className="rounded-xl border border-border bg-card p-4">You checked in for Week {open.week}. Michael&apos;s reply will show up here.</p>}
      {!open && (
        <p className="rounded-xl border border-border bg-card p-4 text-dim">
          {next ? <>Your Week {next.week} check-in opens {fmt(next.opens)} and closes {fmt(next.closes)}.</> : "Your check-ins start in Week 1."}
        </p>
      )}

      {!!history?.length && (
        <div className="space-y-3">
          <h2 className="text-sm uppercase tracking-widest text-dim">Michael&apos;s replies</h2>
          {history.map((c) => {
            const r = (Array.isArray(c.checkin_replies) ? c.checkin_replies[0] : c.checkin_replies) as { final_text?: string | null; video_path?: string | null; sent_at?: string | null } | null;
            return (
              <article key={c.id} className="space-y-2 rounded-xl border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-wider text-accent">{weekName(c.week_number)}</p>
                {r?.sent_at ? (
                  <>
                    {r.video_path && replyVideos.get(r.video_path) && <video src={replyVideos.get(r.video_path)} controls playsInline className="w-full rounded-lg bg-black" />}
                    {r.final_text && <p className="whitespace-pre-line text-[15px]">{r.final_text}</p>}
                  </>
                ) : <p className="text-sm text-dim">Michael is working on your reply.</p>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
