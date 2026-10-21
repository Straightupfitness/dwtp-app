"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function toggleHabit(itemId: string, date: string, done: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const reason = `habit:${date}`;
  if (done) {
    await supabase.from("habit_logs").upsert({ client_id: user.id, item_id: itemId, log_date: date, done: true });
    await supabase.from("cp_ledger").insert({ client_id: user.id, points: 1, reason, source_id: itemId });
  } else {
    await supabase.from("habit_logs").delete().match({ client_id: user.id, item_id: itemId, log_date: date });
    await supabase.from("cp_ledger").delete().match({ client_id: user.id, reason, source_id: itemId });
  }
  revalidatePath("/today");
}

export async function logWeight(formData: FormData) {
  const weight = Number(formData.get("weight"));
  const date = String(formData.get("date"));
  if (!weight || weight < 60 || weight > 600) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("weight_logs").upsert({ client_id: user.id, log_date: date, weight_lbs: weight });
  revalidatePath("/today");
}
