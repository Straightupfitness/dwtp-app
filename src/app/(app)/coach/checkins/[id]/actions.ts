"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  revalidatePath("/coach", "layout");
  return { ok: true };
}
