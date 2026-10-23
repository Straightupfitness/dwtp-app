"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function sendMessage(clientId: string, body: string, attachmentPath: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  if (!body.trim() && !attachmentPath) return { error: "Write a message first." };
  const { error } = await supabase.from("messages").insert({ client_id: clientId, sender_id: user.id, body: body.trim() || null, attachment_path: attachmentPath });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Mark the other side's messages in this thread as read. */
export async function markRead(clientId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { count } = await supabase.from("messages").update({ read_at: new Date().toISOString() }, { count: "exact" })
    .eq("client_id", clientId).neq("sender_id", user.id).is("read_at", null);
  if (count) revalidatePath("/", "layout");
}
