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
