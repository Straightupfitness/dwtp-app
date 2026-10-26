"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { transcribeCheckin } from "@/lib/ai/transcribe";
import { generateDraft } from "@/lib/ai/reply-draft";
import { notify, coachIds } from "@/lib/notify";
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

  // After she sees "Checked in": transcribe her video, draft Michael's reply, and tell him.
  const checkinId = row.id, week = input.week, hasVideo = !!input.videoPath;
  after(async () => {
    const db = adminClient();
    const { data: me } = await db.from("profiles").select("full_name").eq("id", user.id).single();
    if (hasVideo) await transcribeCheckin(db, checkinId);
    try { await generateDraft(db, checkinId); } catch (e) { console.error("auto draft failed", e); }
    // Her next week's Habits & Homework unlocks with this check-in.
    const { data: nextHH } = await db.from("lessons").select("id").eq("kind", "hh").eq("week_number", week + 1).maybeSingle();
    if (nextHH) await notify(user.id, {
      title: `Your Week ${week + 1} Habits & Homework is ready`, body: "Thanks for checking in. Here's what's next.", url: `/lessons/${nextHH.id}`,
      email: "push-fallback", dedupeKey: `hh-ready:${week + 1}`,
    });
    const name = me?.full_name ?? "A client";
    await notify(await coachIds(), {
      title: `${name}: Week ${week} check-in`, body: hasVideo ? "Video check-in. Transcript and draft reply are ready." : "Your draft reply is ready.",
      url: `/coach/checkins/${checkinId}`, email: { subject: `${name} checked in (Week ${week})`, text: `${name} sent her Week ${week} check-in. Your AI draft reply is ready to review.` },
      dedupeKey: `checkin-in:${checkinId}`,
    });
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
