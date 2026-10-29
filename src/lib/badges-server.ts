import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "./supabase/admin";
import { loadDaily } from "./daily";
import { awardBadges, badgeStatus } from "./badges";

/** Her daily numbers and badge runs; saves any badge she has just earned. */
export async function progressFor(supabase: SupabaseClient, clientId: string) {
  const [data, { data: had }] = await Promise.all([
    loadDaily(supabase, clientId, 90),
    supabase.from("badges_earned").select("badge").eq("client_id", clientId),
  ]);
  const earned = new Set((had ?? []).map((b) => b.badge as string));
  const status = badgeStatus(data, earned);
  const fresh = await awardBadges(adminClient(), clientId, status, earned);
  return { data, status, fresh };
}
