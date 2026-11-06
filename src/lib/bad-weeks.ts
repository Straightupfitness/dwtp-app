import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The Bad Week Plan (November 6): when life wins a week she does just three things, and the week still counts
 * toward the 80% (habits and check-ins) for the 15 Pound Guarantee. Up to 3 across the 26 weeks.
 */
export const BAD_WEEK_LIMIT = 3;
export const BAD_WEEK_THREE = [
  { title: "Get outside within 30 minutes of waking", detail: "Even 2 minutes counts." },
  { title: "40 g+ protein at breakfast", detail: "Eggs, Greek yogurt, a protein shake: whatever's easy." },
  { title: "A 10-minute walk", detail: "Any time of day." },
];

/** The weeks she has called a bad week (empty if the feature isn't switched on yet). */
export async function loadBadWeeks(supabase: SupabaseClient, clientId: string): Promise<number[]> {
  const { data, error } = await supabase.from("bad_weeks").select("week_number").eq("client_id", clientId).order("week_number");
  return error ? [] : (data ?? []).map((r) => r.week_number as number);
}

/** Every client's bad weeks at once (for the overview). */
export async function loadBadWeeksFor(supabase: SupabaseClient, ids: string[]) {
  const out = new Map<string, number[]>();
  if (!ids.length) return out;
  const { data, error } = await supabase.from("bad_weeks").select("client_id, week_number").in("client_id", ids);
  if (error) return out;
  for (const r of data ?? []) out.set(r.client_id as string, [...(out.get(r.client_id as string) ?? []), r.week_number as number]);
  return out;
}
