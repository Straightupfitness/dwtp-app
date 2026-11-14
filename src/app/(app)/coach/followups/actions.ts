"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** November 13: Michael messaged her about this topic (or takes that back). */
export async function markFollowup(clientId: string, topic: string, done: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const { error } = await supabase.from("coach_followups").upsert({ client_id: clientId, topic, done_at: done ? new Date().toISOString() : null }, { onConflict: "client_id,topic" });
  if (error) return { error: "Run the follow-ups SQL file first." };
  revalidatePath("/coach/followups");
  return { ok: true };
}

/** November 13: send his message in her app chat (the same words he can also text her from his own phone). */
export async function sendInApp(clientId: string, text: string) {
  if (!text.trim()) return { error: "Write your message first." };
  const { sendMessage } = await import("@/components/chat/actions");
  const r = await sendMessage(clientId, text.trim(), null);
  return r?.error ? { error: r.error } : { ok: true };
}

/**
 * November 13: a video from Michael (recorded with his talking points on screen) goes to her chat with a line of
 * text. `topics`: follow-up topics to mark done (e.g. "blueprint").
 */
export async function sendVideoReply(clientId: string, videoPath: string, note: string, topics: string[] = []) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  if (!videoPath.startsWith(`chat/${clientId}/`)) return { error: "Record the video first." };
  const { sendMessage } = await import("@/components/chat/actions");
  const r = await sendMessage(clientId, note.trim(), videoPath, { kind: "video" });
  if (r?.error) return { error: /check constraint|attachment_kind/i.test(r.error) ? "Run the chat video SQL file first." : r.error };
  for (const topic of topics) await supabase.from("coach_followups").upsert({ client_id: clientId, topic, done_at: new Date().toISOString() }, { onConflict: "client_id,topic" });
  revalidatePath("/coach/followups");
  return { ok: true };
}

/** His Blueprint reply video: to her chat, and she's marked done in the queue. */
export async function sendBlueprintReply(clientId: string, videoPath: string, note: string) {
  return sendVideoReply(clientId, videoPath, note, ["blueprint", "blueprint-reply"]);
}
