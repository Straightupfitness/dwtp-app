import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notify";
import { currentWindow, DEADLINE_TZ } from "@/lib/checkin";
import { programWeek, todayIn } from "@/lib/program";

export const maxDuration = 60;

/**
 * Runs every morning (vercel.json). Wednesday: Strong Body Wednesday is up. Friday: "your check-in is open". Monday: "closes at noon" for anyone
 * who hasn't checked in. Each reminder has a dedupe key, so running it twice never sends twice.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = adminClient();
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: DEADLINE_TZ, weekday: "short" }).format(new Date());
  const { data: clients } = await db.from("profiles").select("id, program_start, status").not("program_start", "is", null).in("status", ["active", "onboarding"]);
  let sent = 0;
  // Wednesday: Strong Body Wednesday is up (for everyone whose week is open).
  if (weekday === "Wed") {
    for (const c of clients ?? []) {
      const today = todayIn("America/Los_Angeles");
      const week = programWeek(c.program_start, today);
      if (!week) continue;
      if (week > 1) {
        const { data: ci } = await db.from("checkins").select("id").eq("client_id", c.id).eq("week_number", week - 1).maybeSingle();
        if (!ci) continue;
      }
      const { data: l } = await db.from("lessons").select("id, title").eq("kind", "sbw").eq("week_number", week).eq("retired", false).maybeSingle();
      if (!l) continue;
      await notify(c.id, {
        title: "Strong Body Wednesday is up", body: l.title, url: `/lessons/${l.id}`,
        email: { subject: `Strong Body Wednesday: ${l.title}`, text: `This week's Strong Body Wednesday is in your app: "${l.title}".` },
        dedupeKey: `sbw:${week}`,
      });
      sent++;
    }
  }
  for (const c of clients ?? []) {
    const { open } = currentWindow(c.program_start);
    if (!open) continue;
    const { data: done } = await db.from("checkins").select("id").eq("client_id", c.id).eq("week_number", open.week).maybeSingle();
    if (done) continue;
    if (weekday === "Fri" || weekday === "Sat") {
      await notify(c.id, {
        title: `Your Week ${open.week} check-in is open`, body: "Plus this week's Strong Mind Friday. Check-in: 3–4 minutes, +10 CPs.", url: "/checkin",
        email: { subject: `Your Week ${open.week} check-in is open`, text: `Your Week ${open.week} check-in is open until Monday at noon (Pacific). It takes 3–4 minutes, and Michael replies personally. This week's Strong Mind Friday is in your app too, under Lessons.` },
        dedupeKey: `checkin-open:${open.week}`,
      });
      sent++;
    } else if (weekday === "Mon") {
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
