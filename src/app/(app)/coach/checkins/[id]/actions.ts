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
  const { error } = await supabase.from("checkin_replies").upsert({
    checkin_id: checkinId, final_text: text, video_path: videoPath,
    updated_at: new Date().toISOString(), ...(send ? { sent_at: new Date().toISOString() } : {}),
  }, { onConflict: "checkin_id" });
  if (error) return { error: error.message };
  if (send) {
    const { data: c } = await supabase.from("checkins").select("client_id, week_number").eq("id", checkinId).single();
    if (c) notifyLater(c.client_id, {
      title: "Michael replied to your check-in", body: `Your Week ${c.week_number} reply is here${videoPath ? " (video)" : ""}.`, url: "/checkin",
      email: { subject: `Michael replied to your Week ${c.week_number} check-in`, text: `Michael sent your Week ${c.week_number} check-in reply${videoPath ? ", with a video" : ""}. Open the app to see it.` },
      dedupeKey: `reply:${checkinId}`,
    });
  }
  revalidatePath("/coach", "layout");
  return { ok: true };
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
