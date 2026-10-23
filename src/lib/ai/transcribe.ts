import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Transcribe a check-in video with Deepgram. Deepgram fetches the video itself from a short-lived
 * signed link, so the file never passes through the app (no size limit on our side).
 */
export async function transcribeCheckin(db: SupabaseClient, checkinId: string): Promise<string | null> {
  const key = process.env.DEEPGRAM_API_KEY?.trim();
  const { data: c } = await db.from("checkins").select("video_path").eq("id", checkinId).single();
  if (!c?.video_path) return null;
  if (!key) { await db.from("checkins").update({ transcript_status: "failed" }).eq("id", checkinId); return null; }
  await db.from("checkins").update({ transcript_status: "pending" }).eq("id", checkinId);

  const { data: signed } = await db.storage.from("checkin-videos").createSignedUrl(c.video_path, 3600);
  if (!signed?.signedUrl) { await db.from("checkins").update({ transcript_status: "failed" }).eq("id", checkinId); return null; }
  try {
    const res = await fetch("https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&paragraphs=true&language=en", {
      method: "POST", headers: { Authorization: `Token ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ url: signed.signedUrl }),
    });
    if (!res.ok) throw new Error(`Deepgram ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const alt = data?.results?.channels?.[0]?.alternatives?.[0];
    const text: string = alt?.paragraphs?.transcript?.trim() || alt?.transcript?.trim() || "";
    await db.from("checkins").update({ transcript: text, transcript_status: "done" }).eq("id", checkinId);
    return text;
  } catch (e) {
    console.error("transcribe failed", e);
    await db.from("checkins").update({ transcript_status: "failed" }).eq("id", checkinId);
    return null;
  }
}
