import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { coachIds, notify } from "@/lib/notify";

export const dynamic = "force-dynamic";
const TZ = "America/Los_Angeles";

/** Minutes since midnight and the date, in Los Angeles, for a moment. */
function la(t: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" })
    .formatToParts(t).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute), dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) };
}
const addDays = (d: string, n: number) => new Date(Date.parse(d + "T12:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
const time = (m: number) => new Date(Date.UTC(2000, 0, 1, Math.floor(m / 60), m % 60)).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });

/**
 * November 26 (Michael): reminders for the events on his calendar (KPIs tab). Supabase calls this every 5 minutes
 * (SQL 41) with a private token. Any timed event (one-time or weekly) with a reminder set sends a push to his phone
 * once its reminder time has come and the event hasn't started yet. Each reminder goes once (dedupe key).
 */
export async function GET(req: Request) {
  const db = adminClient();
  const { data: tok } = await db.from("app_config").select("value").eq("key", "events_cron_token").maybeSingle();
  const secret = process.env.CRON_SECRET?.trim();
  const ok = (tok?.value && req.headers.get("x-cron-token") === tok.value) || (secret && req.headers.get("authorization") === `Bearer ${secret}`);
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: evs, error } = await db.from("kpi_events").select("id, title, kind, weekday, on_date, start_min, remind_min, icon, note")
    .in("kind", ["once", "weekly"]).not("remind_min", "is", null).not("start_min", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = la(new Date());
  const ids = await coachIds();
  let sent = 0;
  // Look at today and the next 7 days, so "1 day before" works too.
  for (let k = 0; k <= 7; k++) {
    const date = addDays(now.date, k);
    const dow = new Date(date + "T12:00:00Z").getUTCDay();
    for (const e of evs ?? []) {
      if (e.kind === "once" ? e.on_date !== date : e.weekday !== dow) continue;
      const startsIn = k * 1440 + e.start_min! - now.min; // minutes from now
      if (startsIn < 0 || startsIn > e.remind_min!) continue;
      const when = startsIn <= 1 ? "now" : startsIn < 60 ? `in ${startsIn} min` : startsIn < 1440 ? `in ${Math.round(startsIn / 6) / 10} h`.replace(".0 h", " h") : "tomorrow";
      await notify(ids, {
        title: `${e.icon ? `${e.icon} ` : ""}${e.title} ${when === "now" ? "is starting" : when}`,
        body: `${k === 0 ? "Today" : k === 1 ? "Tomorrow" : new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })} at ${time(e.start_min!)}${e.note ? ` · ${e.note}` : ""}`,
        url: "/coach/kpis",
        dedupeKey: `event:${e.id}:${date}:${e.start_min}:${e.remind_min}`,
      });
      sent++;
    }
  }
  return NextResponse.json({ ok: true, checked: evs?.length ?? 0, sent });
}
