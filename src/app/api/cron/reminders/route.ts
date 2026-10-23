import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notify";
import { currentWindow, DEADLINE_TZ } from "@/lib/checkin";

export const maxDuration = 60;

/**
 * Runs every morning (vercel.json). Friday: "your check-in is open". Monday: "closes at noon" for anyone
 * who hasn't checked in. Each reminder has a dedupe key, so running it twice never sends twice.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = adminClient();
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: DEADLINE_TZ, weekday: "short" }).format(new Date());
  const { data: clients } = await db.from("profiles").select("id, program_start, status").not("program_start", "is", null).in("status", ["active", "onboarding"]);
  let sent = 0;
  for (const c of clients ?? []) {
    const { open } = currentWindow(c.program_start);
    if (!open) continue;
    const { data: done } = await db.from("checkins").select("id").eq("client_id", c.id).eq("week_number", open.week).maybeSingle();
    if (done) continue;
    if (weekday === "Fri" || weekday === "Sat") {
      await notify(c.id, {
        title: `Your Week ${open.week} check-in is open`, body: "3–4 minutes. Michael replies before Monday is over. +10 CPs.", url: "/checkin",
        email: { subject: `Your Week ${open.week} check-in is open`, text: `Your Week ${open.week} check-in is open until Monday at noon (Pacific). It takes 3–4 minutes, and Michael replies personally.` },
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
