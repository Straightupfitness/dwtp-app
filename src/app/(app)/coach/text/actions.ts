"use server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

/**
 * November 26 (Michael): he texted a client from his own phone through the app, so "I reached out" on the client
 * overview becomes now. Needs SQL 41 (profiles.last_texted_at); quietly does nothing before that.
 */
export async function markClientTexted(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "coach") return { error: "Coach only" };
  const { error } = await adminClient().from("profiles").update({ last_texted_at: new Date().toISOString() }).eq("id", id);
  return error ? { error: error.message } : { ok: true };
}
