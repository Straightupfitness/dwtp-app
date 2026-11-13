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
