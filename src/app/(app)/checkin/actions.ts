"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { flagsFor, windowFor } from "@/lib/checkin";

export async function submitCheckin(input: { week: number; answers: Record<string, unknown>; videoPath: string | null }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const { data: profile } = await supabase.from("profiles").select("program_start").eq("id", user.id).single();
  if (!profile?.program_start) return { error: "Your program hasn't started yet." };

  const win = windowFor(profile.program_start, input.week);
  const now = new Date();
  if (now < win.opens) return { error: "This check-in isn't open yet. It opens Friday." };
  if (now >= win.closes) return { error: "This check-in closed Monday at noon." };

  const a = input.answers;
  const score = (k: string) => { const n = Number(a[k]); return n >= 1 && n <= 10 ? n : null; };
  const { data: last } = await supabase.from("checkins").select("sleep, energy")
    .eq("client_id", user.id).lt("week_number", input.week).order("week_number", { ascending: false }).limit(1).maybeSingle();

  const { data: row, error } = await supabase.from("checkins").insert({
    client_id: user.id, week_number: input.week,
    sleep: score("sleep"), energy: score("energy"), stress: score("stress"), hunger: score("hunger"),
    answers: a, video_path: input.videoPath, flags: flagsFor(a, last), on_time: true,
  }).select("id").single();
  if (error) return { error: error.code === "23505" ? "You've already checked in this week." : error.message };

  await supabase.from("cp_ledger").insert({ client_id: user.id, points: 10, reason: "checkin", source_id: row.id });
  revalidatePath("/", "layout");
  return { ok: true };
}
