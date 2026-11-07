"use server";
import { createClient } from "@/lib/supabase/server";
import { draftFoodFeedback } from "@/lib/ai/food-feedback";
import { sendMessage } from "@/components/chat/actions";

async function coach() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return me?.role === "coach" ? supabase : null;
}
const missingTable = (m?: string) => !!m && /food_feedback|relation|schema cache/i.test(m);

/** Draft (or redraft) her food note for one day, and keep the draft. */
export async function draftFeedback(clientId: string, day: string) {
  const supabase = await coach();
  if (!supabase) return { error: "Coach only" };
  try {
    const text = await draftFoodFeedback(supabase, clientId, day);
    await supabase.from("food_feedback").upsert({ client_id: clientId, day, draft: text, updated_at: new Date().toISOString() }, { onConflict: "client_id,day" });
    return { text };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("food feedback draft", m.slice(0, 300));
    return { error: /credit|balance|billing|40[0-9]|5\d\d/i.test(m) ? "The AI isn't available right now (check the Anthropic account). You can still write it yourself." : m.startsWith("Nothing logged") ? m : "Couldn't draft this one. Try again." };
  }
}

/** Mark it sent (by text, or in the app chat) or skipped. */
async function mark(supabase: NonNullable<Awaited<ReturnType<typeof coach>>>, clientId: string, day: string, via: "chat" | "text" | "skipped", text: string | null) {
  const { error } = await supabase.from("food_feedback").upsert({
    client_id: clientId, day, sent_text: text, sent_via: via, sent_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }, { onConflict: "client_id,day" });
  if (error && missingTable(error.message)) return { ok: true }; // sent; it just isn't remembered until SQL 15 is run (the page says so)
  return error ? { error: error.message } : { ok: true };
}

export async function sendFeedbackInChat(clientId: string, day: string, text: string) {
  const supabase = await coach();
  if (!supabase) return { error: "Coach only" };
  if (!text.trim()) return { error: "Write something first." };
  const r = await sendMessage(clientId, text.trim(), null);
  if (r?.error) return r;
  return mark(supabase, clientId, day, "chat", text.trim());
}

export async function markTexted(clientId: string, day: string, text: string) {
  const supabase = await coach();
  if (!supabase) return { error: "Coach only" };
  return mark(supabase, clientId, day, "text", text.trim());
}

export async function skipFeedback(clientId: string, day: string) {
  const supabase = await coach();
  if (!supabase) return { error: "Coach only" };
  return mark(supabase, clientId, day, "skipped", null);
}

export async function undoFeedback(clientId: string, day: string) {
  const supabase = await coach();
  if (!supabase) return { error: "Coach only" };
  await supabase.from("food_feedback").update({ sent_text: null, sent_via: null, sent_at: null }).eq("client_id", clientId).eq("day", day);
  return { ok: true };
}
