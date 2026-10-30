"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AUTO_HABITS } from "@/lib/circles";
import { awardAutoHabit, closeOutRings } from "@/lib/progress";
import { todayIn } from "@/lib/program";

/** A missed day can be filled in for up to 14 days back (October 30). */
const BACK = 14;
async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: p } = user ? await supabase.from("profiles").select("timezone").eq("id", user.id).single() : { data: null };
  const today = todayIn(p?.timezone ?? "America/Los_Angeles");
  const ok = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today && d >= new Date(Date.parse(today) - BACK * 86_400_000).toISOString().slice(0, 10);
  return { supabase, user, ok };
}

export async function weightOn(date: string, weight: number | null) {
  const { supabase, user, ok } = await me();
  if (!user || !ok(date)) return { error: "Pick a day in the last two weeks." };
  if (weight === null) { await supabase.from("weight_logs").delete().eq("client_id", user.id).eq("log_date", date); }
  else {
    if (!(weight >= 60 && weight <= 600)) return { error: "That weight doesn't look right." };
    await supabase.from("weight_logs").upsert({ client_id: user.id, log_date: date, weight_lbs: Math.round(weight * 10) / 10 });
    await awardAutoHabit(supabase, user.id, "weigh-in", date);
    await closeOutRings(supabase, user.id);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function waterOn(date: string, oz: number) {
  const { supabase, user, ok } = await me();
  if (!user || !ok(date)) return { error: "Pick a day in the last two weeks." };
  const v = Math.max(0, Math.min(1000, Math.round(oz) || 0));
  await supabase.from("water_days").upsert({ client_id: user.id, day: date, oz: v, updated_at: new Date().toISOString() });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Check a daily habit off (or undo it) for a past day. Same CP and streak rules as today. */
export async function habitOn(itemId: string, date: string, done: boolean) {
  const { supabase, user, ok } = await me();
  if (!user || !ok(date)) return { error: "Pick a day in the last two weeks." };
  const { data: item } = await supabase.from("ring_items").select("id, cadence, item_type, habit_key").eq("id", itemId).single();
  if (!item || item.item_type === "hit" || (item.habit_key && AUTO_HABITS[item.habit_key])) return { error: "This one checks itself off." };
  const { data: linked } = item.habit_key ? await supabase.from("ring_items").select("id").eq("habit_key", item.habit_key) : { data: [{ id: itemId }] };
  const ids = (linked ?? [{ id: itemId }]).map((r) => r.id as string);
  if (done) {
    await supabase.from("habit_logs").upsert(ids.map((id) => ({ client_id: user.id, item_id: id, log_date: date, done: true })));
    const { data: had } = await supabase.from("cp_ledger").select("id").eq("client_id", user.id).eq("reason", `habit:${date}`).in("source_id", ids).limit(1).maybeSingle();
    if (!had) await supabase.from("cp_ledger").insert({ client_id: user.id, points: 1, reason: `habit:${date}`, source_id: itemId });
  } else {
    await supabase.from("habit_logs").delete().eq("client_id", user.id).in("item_id", ids).eq("log_date", date);
    await supabase.from("cp_ledger").delete().eq("client_id", user.id).in("source_id", ids).eq("reason", `habit:${date}`);
  }
  await closeOutRings(supabase, user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}
