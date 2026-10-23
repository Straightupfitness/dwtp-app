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
