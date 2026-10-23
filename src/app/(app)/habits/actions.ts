"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AUTO_HABITS } from "@/lib/circles";
import { closeOutRings } from "@/lib/progress";
import { todayIn } from "@/lib/program";

/**
 * Check a habit off (or undo it) for today. A habit that lives in two circles is logged in both.
 * 1 CP per check-off. Then any ring whose habits are all complete is closed out (+50 CPs),
 * and a finished circle earns +250 CPs.
 */
export async function toggleHabit(itemId: string, done: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: profile } = await supabase.from("profiles").select("timezone, program_start").eq("id", user.id).single();
  const today = todayIn(profile?.timezone ?? "America/Los_Angeles");

  const { data: item } = await supabase.from("ring_items").select("id, cadence, item_type, habit_key").eq("id", itemId).single();
  if (!item || item.item_type === "hit" || (item.habit_key && AUTO_HABITS[item.habit_key])) return;
  const { data: linked } = item.habit_key
    ? await supabase.from("ring_items").select("id").eq("habit_key", item.habit_key)
    : { data: [{ id: itemId }] };
  const ids = (linked ?? [{ id: itemId }]).map((r) => r.id as string);

  if (done) {
    await supabase.from("habit_logs").upsert(ids.map((id) => ({ client_id: user.id, item_id: id, log_date: today, done: true })));
    await supabase.from("cp_ledger").insert({ client_id: user.id, points: 1, reason: `habit:${today}`, source_id: itemId });
  } else {
    // Daily: undo today. Weekly and one-time: undo this program week's check-off.
    let from = today;
    if (item.cadence !== "daily" && profile?.program_start) {
      const days = Math.floor((Date.parse(today) - Date.parse(profile.program_start)) / 86_400_000);
      from = new Date(Date.parse(profile.program_start) + Math.floor(days / 7) * 7 * 86_400_000).toISOString().slice(0, 10);
    }
    const { data: gone } = await supabase.from("habit_logs").select("log_date")
      .eq("client_id", user.id).in("item_id", ids).gte("log_date", from).lte("log_date", today);
    await supabase.from("habit_logs").delete().eq("client_id", user.id).in("item_id", ids).gte("log_date", from).lte("log_date", today);
    const reasons = [...new Set((gone ?? []).map((g) => `habit:${g.log_date}`))];
    if (reasons.length) await supabase.from("cp_ledger").delete().eq("client_id", user.id).in("source_id", ids).in("reason", reasons);
  }

  await closeOutRings(supabase, user.id);
  revalidatePath("/", "layout");
}
