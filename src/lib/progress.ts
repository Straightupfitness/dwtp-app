/** Server-side bookkeeping after anything that can move a ring forward (habit, weight, meal). */
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadProgram } from "./circles";
import { CIRCLE_CPS } from "./program";

/** 1 CP the first time an automatic habit (weigh-in, log-food) is done on a date. */
export async function awardAutoHabit(supabase: SupabaseClient, userId: string, key: string, date: string) {
  const { data: item } = await supabase.from("ring_items").select("id").eq("habit_key", key).limit(1).maybeSingle();
  if (!item) return;
  const reason = `habit:${date}`;
  const { data: had } = await supabase.from("cp_ledger").select("id").eq("client_id", userId)
    .eq("reason", reason).eq("source_id", item.id).limit(1).maybeSingle();
  if (!had) await supabase.from("cp_ledger").insert({ client_id: userId, points: 1, reason, source_id: item.id });
}

/**
 * Save newly opened rings (so "day 3" stays day 3), close out rings whose habits are all complete
 * (+50 CPs), and award +250 CPs for a finished circle.
 */
export async function closeOutRings(supabase: SupabaseClient, userId: string) {
  const state = await loadProgram(supabase, userId);
  const newlyOpen = state.circles.flatMap((c) => c.rings).filter((r) => r.status === "open" && !r.saved && r.opensOn);
  if (newlyOpen.length) {
    await supabase.from("client_rings").upsert(
      newlyOpen.map((r) => ({ client_id: userId, ring_id: r.id, status: "open", opened_on: r.opensOn })),
      { onConflict: "client_id,ring_id", ignoreDuplicates: true });
  }
  for (const c of state.circles) {
    let changed = false;
    for (const r of c.rings) {
      if (r.status !== "open" || !r.items.length || !r.items.every((i) => i.complete)) continue;
      await supabase.from("client_items").upsert(
        r.items.map((i) => ({ client_id: userId, item_id: i.id, completed_on: state.today })),
        { onConflict: "client_id,item_id", ignoreDuplicates: true });
      await supabase.from("client_rings").upsert({
        client_id: userId, ring_id: r.id, status: "complete", opened_on: r.opensOn ?? state.today, completed_on: state.today,
      }, { onConflict: "client_id,ring_id" });
      await supabase.from("cp_ledger").insert({ client_id: userId, points: r.cps, reason: "ring", source_id: r.id });
      r.status = "complete";
      changed = true;
    }
    if (changed && c.rings.every((r) => r.status === "complete")) {
      await supabase.from("cp_ledger").insert({ client_id: userId, points: CIRCLE_CPS, reason: "circle", source_id: c.id });
    }
  }
}
