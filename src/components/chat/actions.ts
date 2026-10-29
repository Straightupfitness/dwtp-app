"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyLater, coachIds } from "@/lib/notify";

export async function sendMessage(clientId: string, body: string, attachmentPath: string | null,
  opts: { kind?: "image" | "audio"; replyTo?: string | null; seconds?: number | null } = {}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  if (!body.trim() && !attachmentPath) return { error: "Write a message first." };
  const kind = attachmentPath ? opts.kind ?? "image" : null;
  const { error } = await supabase.from("messages").insert({
    client_id: clientId, sender_id: user.id, body: body.trim() || null, attachment_path: attachmentPath, attachment_kind: kind,
    reply_to: opts.replyTo ?? null, audio_seconds: kind === "audio" ? Math.round(opts.seconds ?? 0) || null : null,
  });
  if (error) return { error: error.message };
  const fromClient = user.id === clientId;
  const { data: me } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
  const preview = body.trim() ? body.trim().slice(0, 120) : kind === "audio" ? "Sent a voice note" : "Sent a photo";
  notifyLater(fromClient ? coachIds() : clientId, {
    title: fromClient ? (me?.full_name ?? "New message") : "Michael", body: preview,
    url: fromClient ? `/coach/inbox/${clientId}` : "/chat", email: "push-fallback",
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Change the words of a message she (or Michael) sent. Shows "edited". */
export async function editMessage(id: string, body: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  if (!body.trim()) return { error: "A message can't be empty." };
  const { data: m } = await supabase.from("messages").select("sender_id, body").eq("id", id).maybeSingle();
  if (!m || m.sender_id !== user.id) return { error: "You can only edit your own messages." };
  if (m.body === body.trim()) return { ok: true };
  const { error } = await supabase.from("messages").update({ body: body.trim(), edited_at: new Date().toISOString() }).eq("id", id).eq("sender_id", user.id);
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

/** Like (♥) a message from the other person, or take the like back (October 29). */
export async function toggleHeart(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: m } = await supabase.from("messages").select("sender_id, hearted_at").eq("id", id).maybeSingle();
  if (!m || m.sender_id === user.id) return;
  await supabase.from("messages").update({ hearted_at: m.hearted_at ? null : new Date().toISOString() }).eq("id", id);
  revalidatePath("/", "layout");
}
