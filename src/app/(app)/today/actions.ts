"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { awardAutoHabit, closeOutRings } from "@/lib/progress";

export async function logWeight(formData: FormData) {
  const weight = Number(formData.get("weight"));
  const date = String(formData.get("date"));
  if (!weight || weight < 60 || weight > 600) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("weight_logs").upsert({ client_id: user.id, log_date: date, weight_lbs: weight });
  await awardAutoHabit(supabase, user.id, "weigh-in", date);
  await closeOutRings(supabase, user.id);
  revalidatePath("/", "layout");
}

/** She types her steps for today (or yesterday). Matching step habits check themselves off. */
export async function logSteps(formData: FormData) {
  const steps = Math.round(Number(String(formData.get("steps") ?? "").replace(/[^\d]/g, "")));
  const date = String(formData.get("date") ?? "");
  if (!Number.isFinite(steps) || steps < 0 || steps > 150_000 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: p } = await supabase.from("profiles").select("timezone").eq("id", user.id).single();
  const { todayIn } = await import("@/lib/program");
  const today = todayIn(p?.timezone ?? "America/Los_Angeles");
  const yesterday = new Date(Date.parse(today + "T00:00:00Z") - 86_400_000).toISOString().slice(0, 10);
  if (date !== today && date !== yesterday) return;
  const { adminClient } = await import("@/lib/supabase/admin");
  const { applyDay } = await import("@/lib/health");
  await applyDay(adminClient(), user.id, date, { steps }, "set", "manual");
  revalidatePath("/", "layout");
}

/**
 * Water (October 29): add (or take back) ounces for today. At her goal (1 gallon unless Michael changes it),
 * her open "gallon of water" habit checks itself off (+1 CP, once).
 */
export async function addWater(delta: number) {
  if (!Number.isFinite(delta) || Math.abs(delta) > 64) return { error: "Bad amount" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const { data: p } = await supabase.from("profiles").select("timezone, water_goal_oz").eq("id", user.id).single();
  const { todayIn } = await import("@/lib/program");
  const day = todayIn(p?.timezone ?? "America/Los_Angeles");
  const { data: had } = await supabase.from("water_days").select("oz").eq("client_id", user.id).eq("day", day).maybeSingle();
  const oz = Math.max(0, Math.min(1000, (had?.oz ?? 0) + Math.round(delta)));
  const { error } = await supabase.from("water_days").upsert({ client_id: user.id, day, oz, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  const goal = p?.water_goal_oz ?? 128;
  if (oz >= goal && (had?.oz ?? 0) < goal) {
    const { loadProgram } = await import("@/lib/circles");
    const state = await loadProgram(supabase, user.id);
    const items = state.circles.flatMap((c) => c.rings.filter((r) => r.status === "open").flatMap((r) => r.items)).filter((i) => /gallon of water/i.test(i.title));
    for (const it of items) {
      await supabase.from("habit_logs").upsert({ client_id: user.id, item_id: it.id, log_date: day, done: true });
      const { data: cp } = await supabase.from("cp_ledger").select("id").eq("client_id", user.id).eq("reason", `habit:${day}`).eq("source_id", it.id).limit(1).maybeSingle();
      if (!cp) await supabase.from("cp_ledger").insert({ client_id: user.id, points: 1, reason: `habit:${day}`, source_id: it.id });
    }
    if (items.length) await closeOutRings(supabase, user.id);
  }
  revalidatePath("/", "layout");
  return { ok: true, oz };
}
