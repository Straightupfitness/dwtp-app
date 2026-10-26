"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** She picks the days she trains (0 = Sunday … 6 = Saturday). */
export async function setWorkoutDays(days: number[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const clean = Array.from(new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))).sort();
  await supabase.from("profiles").update({ workout_days: clean }).eq("id", user.id);
  revalidatePath("/calendar");
}
