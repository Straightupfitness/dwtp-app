"use server";
import { adminClient } from "@/lib/supabase/admin";
import { recordSeen } from "@/lib/seen";
import { createClient, viewAsInfo } from "@/lib/supabase/server";

/**
 * November 13: she came back to the app from the background (no page load, so the layout's "last seen" didn't run).
 * Same rule as the layout: at most one write every 15 minutes.
 */
export async function seenNow() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: me } = await supabase.from("profiles").select("role, timezone").eq("id", user.id).single();
  if (me?.role !== "client" || (await viewAsInfo())) return;
  const now = new Date(), cutoff = new Date(now.getTime() - 15 * 60_000).toISOString();
  const db = adminClient();
  const { data: bumped, error } = await db.from("profiles").update({ last_seen_at: now.toISOString() }).eq("id", user.id).or(`last_seen_at.is.null,last_seen_at.lt.${cutoff}`).select("id");
  if (bumped?.length || error) await recordSeen(db, user.id, me?.timezone ?? null);
}
