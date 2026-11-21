"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyLater } from "@/lib/notify";

export async function saveReply(checkinId: string, text: string, videoPath: string | null, send: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").single();
  if (me?.role !== "coach") return { error: "Coach only" };
  if (send && !text.trim() && !videoPath) return { error: "Write a reply or add a video first." };
  const { data: before } = await supabase.from("checkin_replies").select("sent_at, video_path").eq("checkin_id", checkinId).maybeSingle();
  const { error } = await supabase.from("checkin_replies").upsert({
    checkin_id: checkinId, final_text: text, ...(videoPath ? { video_path: videoPath } : {}),
    updated_at: new Date().toISOString(), ...(send ? { sent_at: new Date().toISOString() } : {}),
  }, { onConflict: "checkin_id" });
  if (error) return { error: error.message };
  if (send) {
    const { data: c } = await supabase.from("checkins").select("client_id, week_number").eq("id", checkinId).single();
    // November 20 (Michael): the reply also lands in her chat inbox (video + his text), the first time he sends it.
    const video = videoPath ?? before?.video_path ?? null;
    if (c && !before?.sent_at) await toChat(supabase, user!.id, c.client_id, c.week_number, text, video);
    if (c) notifyLater(c.client_id, {
      title: "Michael replied to your check-in", body: `Your Week ${c.week_number} reply is here${video ? " (video)" : ""}. It's in your chat too.`, url: "/chat",
      email: { subject: `Michael replied to your Week ${c.week_number} check-in`, text: `Michael sent your Week ${c.week_number} check-in reply${videoPath ? ", with a video" : ""}. Open the app to see it.` },
      dedupeKey: `reply:${checkinId}`,
    });
  }
  revalidatePath("/coach", "layout");
  return { ok: true };
}

/** Copies his reply video into her chat's files and posts it there with his text. Never blocks sending the reply. */
async function toChat(supabase: Awaited<ReturnType<typeof createClient>>, coachId: string, clientId: string, week: number, text: string, video: string | null) {
  try {
    let path: string | null = null;
    if (video) {
      const to = `chat/${clientId}/${crypto.randomUUID()}.${video.split(".").pop() || "mp4"}`;
      const { error } = await supabase.storage.from("checkin-videos").copy(video, to, { destinationBucket: "media" });
      if (!error) path = to;
      else {
        const { data: file } = await supabase.storage.from("checkin-videos").download(video);
        if (file && !(await supabase.storage.from("media").upload(to, file, { contentType: file.type || "video/mp4" })).error) path = to;
      }
    }
    const { data: her } = await supabase.from("profiles").select("full_name").eq("id", clientId).maybeSingle();
    const first = (her?.full_name ?? "").trim().split(/\s+/)[0];
    const body = [`Hi${first ? ` ${first}` : ""}, here is your week ${week} check-in reply ⬆️`, text.trim()].filter(Boolean).join("\n\n");
    const { error } = await supabase.from("messages").insert({ client_id: clientId, sender_id: coachId, body, attachment_path: path, attachment_kind: path ? "video" : null });
    if (error) console.error("check-in reply to chat failed", error.message);
  } catch (e) { console.error("check-in reply to chat failed", e); }
}

export async function transcribeNow(checkinId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").single();
  if (me?.role !== "coach") return;
  const { transcribeCheckin } = await import("@/lib/ai/transcribe");
  await transcribeCheckin(supabase, checkinId);
  revalidatePath(`/coach/checkins/${checkinId}`);
}
