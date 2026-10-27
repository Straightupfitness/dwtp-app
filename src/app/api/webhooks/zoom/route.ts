import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { adminClient } from "@/lib/supabase/admin";
import { meetingIdFrom, publishReplay } from "@/lib/replays";

export const maxDuration = 60;

/**
 * Zoom calls this when a cloud recording is ready ("All Recordings have completed").
 * Only Michael's Real Talk Tuesday meeting is posted: the meeting ID in his Zoom link (Coach → Calendar),
 * or, without a link, a meeting whose topic includes "Real Talk".
 * Every request is checked against ZOOM_WEBHOOK_SECRET (the app's Secret Token in Zoom).
 */
export async function POST(req: Request) {
  const secret = process.env.ZOOM_WEBHOOK_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "ZOOM_WEBHOOK_SECRET is not set in Vercel." }, { status: 500 });
  const raw = await req.text();
  let body: { event?: string; payload?: Record<string, unknown> };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); }
  const sign = (s: string) => createHmac("sha256", secret).update(s).digest("hex");

  // Zoom checks the address once when you save it.
  if (body.event === "endpoint.url_validation") {
    const plainToken = String((body.payload as { plainToken?: string })?.plainToken ?? "");
    return NextResponse.json({ plainToken, encryptedToken: sign(plainToken) });
  }

  const ts = req.headers.get("x-zm-request-timestamp") ?? "";
  const got = req.headers.get("x-zm-signature") ?? "";
  const want = `v0=${sign(`v0:${ts}:${raw}`)}`;
  const fresh = Math.abs(Date.now() / 1000 - Number(ts)) < 5 * 60;
  if (!fresh || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  if (body.event !== "recording.completed") return NextResponse.json({ ok: true, ignored: body.event });
  const o = (body.payload?.object ?? {}) as {
    id?: number | string; uuid?: string; topic?: string; start_time?: string; duration?: number;
    share_url?: string; password?: string; recording_play_passcode?: string;
    recording_files?: { recording_type?: string; play_url?: string; file_type?: string }[];
  };
  const { data: s } = await adminClient().from("program_settings").select("value").eq("key", "rtt_zoom_url").maybeSingle();
  const rttId = meetingIdFrom(s?.value);
  const isRtt = rttId ? String(o.id) === rttId : /real\s*talk/i.test(o.topic ?? "");
  if (!isRtt) return NextResponse.json({ ok: true, ignored: "not Real Talk Tuesday" });

  const video = o.recording_files?.find((f) => f.file_type === "MP4" && /speaker|gallery|shared_screen/i.test(f.recording_type ?? ""));
  const url = o.share_url || video?.play_url;
  if (!url || !o.start_time) return NextResponse.json({ ok: true, ignored: "no share link" });
  const r = await publishReplay({ url, passcode: o.password || null, startedAt: o.start_time, durationMin: o.duration ?? null, zoomUuid: o.uuid ?? null, topic: o.topic ?? null });
  return NextResponse.json({ ok: true, ...r });
}
