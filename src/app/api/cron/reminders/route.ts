import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notify";
import { currentWindow, DEADLINE_TZ } from "@/lib/checkin";
import { programWeek, todayIn } from "@/lib/program";
import { lessonEmail } from "@/lib/lesson-email";

export const maxDuration = 60;
const APP = () => (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.straightupfitness.com").replace(/\/$/, "");

/**
 * Runs every morning (vercel.json, 16:00 UTC = 8–9 AM Pacific). Every message has a dedupe key, so running it twice never sends twice.
 * - Wednesday: the full Strong Body Wednesday email (and a push) to everyone whose week is unlocked.
 * - Friday: the full Strong Mind Friday email with a "Do your check-in" button. If her week is still locked
 *   (no check-in last week), just the check-in reminder. Saturday repeats Friday for anyone it missed.
 * - Monday: "your check-in closes at noon" for anyone who hasn't checked in.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = adminClient();
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: DEADLINE_TZ, weekday: "short" }).format(new Date());
  const { data: clients } = await db.from("profiles").select("id, full_name, program_start, timezone, status")
    .not("program_start", "is", null).in("status", ["active", "onboarding"]);
  const { data: lessons } = await db.from("lessons").select("id, kind, title, body, week_number").in("kind", ["sbw", "smf"]).eq("retired", false).not("week_number", "is", null);
  const lessonFor = (kind: string, week: number) => (lessons ?? []).find((l) => l.kind === kind && l.week_number === week);
  const checkedIn = async (id: string, week: number) =>
    !!(await db.from("checkins").select("id").eq("client_id", id).eq("week_number", week).maybeSingle()).data;
  // Friday's email and Saturday's catch-up share one slot: if either went out this week, don't send another.
  const alreadySent = async (id: string, keys: string[]) =>
    !!(await db.from("notification_log").select("key").eq("user_id", id).in("key", keys).limit(1).maybeSingle()).data;
  let sent = 0;

  for (const c of clients ?? []) {
    const week = programWeek(c.program_start, todayIn(c.timezone ?? "America/Los_Angeles"));
    if (!week) continue;
    const first = c.full_name?.split(" ")[0] ?? null;
    const unlocked = week === 1 || (await checkedIn(c.id, week - 1));

    if (weekday === "Wed" && unlocked) {
      const l = lessonFor("sbw", week);
      if (!l) continue;
      const email = lessonEmail({ kind: "sbw", week, title: l.title, body: l.body, firstName: first,
        button: { label: "Watch the video", url: `${APP()}/lessons/${l.id}` } });
      await notify(c.id, { title: "Strong Body Wednesday is up", body: l.title, url: `/lessons/${l.id}`, email, dedupeKey: `sbw:${week}` });
      sent++;
    }

    if (weekday === "Fri" || weekday === "Sat") {
      const { open } = currentWindow(c.program_start);
      const done = open ? await checkedIn(c.id, open.week) : true;
      if (await alreadySent(c.id, [`smf:${week}`, ...(open ? [`checkin-open:${open.week}`] : [])])) continue;
      const l = unlocked ? lessonFor("smf", week) : undefined;
      if (l) {
        const email = lessonEmail({ kind: "smf", week, title: l.title, body: l.body, firstName: first,
          button: done ? { label: "Read it in the app", url: `${APP()}/lessons/${l.id}` } : { label: `Do your Week ${open!.week} check-in`, url: `${APP()}/checkin` },
          secondary: done ? undefined : { label: "Read it in the app", url: `${APP()}/lessons/${l.id}` } });
        await notify(c.id, done
          ? { title: "Strong Mind Friday is up", body: l.title, url: `/lessons/${l.id}`, email, dedupeKey: `smf:${week}` }
          : { title: `Your Week ${open!.week} check-in is open`, body: `Plus Strong Mind Friday: ${l.title}`, url: "/checkin", email, dedupeKey: `checkin-open:${open!.week}` });
        sent++;
      } else if (open && !done) {
        await notify(c.id, {
          title: `Your Week ${open.week} check-in is open`, body: "3–4 minutes. Michael replies before Monday is over. +10 CPs.", url: "/checkin",
          email: { subject: `Your Week ${open.week} check-in is open`, text: `Your Week ${open.week} check-in is open until Monday at noon (Pacific). It takes 3–4 minutes, and Michael replies personally.` },
          dedupeKey: `checkin-open:${open.week}`,
        });
        sent++;
      }
    }

    if (weekday === "Mon") {
      const { open } = currentWindow(c.program_start);
      if (!open || (await checkedIn(c.id, open.week))) continue;
      await notify(c.id, {
        title: "Check-in closes at noon today", body: `Your Week ${open.week} check-in closes at 12 PM Pacific.`, url: "/checkin",
        email: { subject: "Your check-in closes at noon today", text: `Quick reminder: your Week ${open.week} check-in closes today at 12 PM Pacific. After that it's locked until next Friday.` },
        dedupeKey: `checkin-last-call:${open.week}`,
      });
      sent++;
    }
  }
  return NextResponse.json({ ok: true, weekday, sent });
}
