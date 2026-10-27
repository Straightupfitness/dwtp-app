import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { coachIds, notify } from "@/lib/notify";
import { todayIn } from "@/lib/program";

const fmt = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);

/** The Zoom meeting ID in Michael's Real Talk Tuesday link (zoom.us/j/12345678901). */
export function meetingIdFrom(url: string | null | undefined) {
  return url?.match(/\/j\/(\d{9,12})/)?.[1] ?? null;
}

/**
 * A Real Talk Tuesday replay is ready: save it on that week's Tuesday (so it shows on every calendar),
 * post it in Community as Michael, and tell everyone once.
 */
export async function publishReplay(r: { url: string; passcode?: string | null; startedAt: string; durationMin?: number | null; zoomUuid?: string | null; topic?: string | null }) {
  const db = adminClient();
  const date = todayIn("America/Los_Angeles", new Date(r.startedAt));
  const dow = new Date(date + "T12:00:00Z").getUTCDay();
  const tuesday = addDays(date, 2 - ((dow + 6) % 7) - 1); // that week's Tuesday (weeks run Mon–Sun)
  const { data: existing } = await db.from("calls").select("title, post_id, zoom_uuid").eq("call_date", tuesday).maybeSingle();
  if (existing?.zoom_uuid && existing.zoom_uuid === r.zoomUuid && existing.post_id) return { tuesday, duplicate: true };

  await db.from("calls").upsert({
    call_date: tuesday, title: existing?.title ?? null, replay_url: r.url, passcode: r.passcode ?? null, zoom_uuid: r.zoomUuid ?? null,
    recorded_at: r.startedAt, duration_min: r.durationMin ?? null, cancelled: false, updated_at: new Date().toISOString(),
  });

  if (!existing?.post_id) {
    const [coach] = await coachIds();
    if (coach) {
      const topic = existing?.title ? `\n${existing.title}` : "";
      const body = `Real Talk Tuesday replay · ${fmt(tuesday)}${topic}\n\nMissed the call, or want to hear it again? Watch it here:\n${r.url}${r.passcode ? `\nPasscode: ${r.passcode}` : ""}`;
      const { data: post } = await db.from("posts").insert({ author_id: coach, body }).select("id").single();
      if (post) await db.from("calls").update({ post_id: post.id }).eq("call_date", tuesday);
    }
    const { data: clients } = await db.from("profiles").select("id").eq("role", "client").in("status", ["active", "onboarding"]);
    await notify((clients ?? []).map((c) => c.id), {
      title: "Real Talk Tuesday replay is up", body: existing?.title ?? "Watch it in Community or on your calendar.", url: "/community",
      email: "push-fallback", dedupeKey: `rtt-replay:${tuesday}`,
    });
  }
  return { tuesday, duplicate: false };
}
