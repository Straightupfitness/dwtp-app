import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notify";
import { DEADLINE_TZ, zonedInstant } from "@/lib/checkin";
import { RTT_HOUR, RTT_MINUTE } from "@/lib/calendar";
import { todayIn } from "@/lib/program";

export const maxDuration = 60;

/**
 * Real Talk Tuesday reminders: a push 60 minutes before the call and another 5 minutes before.
 * Called every 5 minutes on Tuesday afternoons by Supabase (pg_cron, migration 0022), so it doesn't depend on
 * the Vercel plan. It only sends inside those two windows and each reminder has a dedupe key, so calling it
 * at any other time, or twice, sends nothing.
 */
export async function GET() {
  const now = new Date();
  const today = todayIn(DEADLINE_TZ, now);
  if (new Date(today + "T12:00:00Z").getUTCDay() !== 2) return NextResponse.json({ ok: true, skipped: "not Tuesday" });
  const callAt = zonedInstant(today, RTT_HOUR, DEADLINE_TZ).getTime() + RTT_MINUTE * 60_000;
  const mins = (callAt - now.getTime()) / 60_000;
  const which = mins > 57 && mins <= 63 ? "60" : mins > 2 && mins <= 8 ? "5" : null;
  if (!which) return NextResponse.json({ ok: true, skipped: `${Math.round(mins)} min to the call` });

  const db = adminClient();
  const { data: call } = await db.from("calls").select("cancelled, title").eq("call_date", today).maybeSingle();
  if (call?.cancelled) return NextResponse.json({ ok: true, skipped: "call cancelled" });
  const { data: clients } = await db.from("profiles").select("id").eq("role", "client").in("status", ["active", "onboarding"]);
  const ids = (clients ?? []).map((c) => c.id);
  const topic = call?.title ? ` ${call.title}.` : "";
  await notify(ids, which === "60"
    ? { title: "Real Talk Tuesday in 1 hour", body: `Today at 4:30 PM Pacific.${topic} Tap to get the Zoom link.`, url: "/rtt", dedupeKey: `rtt-60:${today}` }
    : { title: "Real Talk Tuesday starts in 5 minutes", body: `Tap to join Michael on Zoom.${topic}`, url: "/rtt", dedupeKey: `rtt-5:${today}` });
  return NextResponse.json({ ok: true, sent: which, to: ids.length });
}
