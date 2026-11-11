"use server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { coachIds, notify } from "@/lib/notify";
import { blueprintLabels } from "@/lib/blueprint";
import { summarizeBlueprint } from "@/lib/ai/blueprint-summary";
import { assignFromBlueprint } from "@/lib/assign";

type Answers = Record<string, unknown>;

/** Her old 7X answers (an assessment sent before November 10) stay with the new Blueprint, under "previous". */
async function withPrevious(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, answers: Answers): Promise<Answers> {
  const { data } = await supabase.from("assessments").select("answers, submitted_at").eq("client_id", userId).maybeSingle();
  const old = (data?.answers ?? {}) as Answers;
  if (old.previous) return { ...answers, previous: old.previous };
  if (data?.submitted_at && String(data.submitted_at).slice(0, 10) < "2026-11-10") return { ...answers, previous: { ...old, submitted_at: data.submitted_at } };
  return answers;
}

/** Saved as she goes, so she can stop and finish later. */
export async function saveBlueprint(answers: Answers) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You're signed out. Sign in again and pick up where you left off." };
  const { error } = await supabase.from("assessments").upsert({ client_id: user.id, answers: await withPrevious(supabase, user.id, answers), submitted_at: null }, { onConflict: "client_id" });
  return error ? { error: "Couldn't save. Check your connection." } : { ok: true };
}

/** Transcribe her video answers with Deepgram (best effort). */
async function transcribe(videos: Record<string, string>): Promise<string> {
  const key = process.env.DEEPGRAM_API_KEY?.trim();
  if (!key || !Object.keys(videos).length) return "";
  const db = adminClient();
  const labels = blueprintLabels();
  const parts: string[] = [];
  for (const [qid, path] of Object.entries(videos)) {
    const { data: signed } = await db.storage.from("checkin-videos").createSignedUrl(path, 3600);
    if (!signed?.signedUrl) continue;
    try {
      const res = await fetch("https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&paragraphs=true&language=en", {
        method: "POST", headers: { Authorization: `Token ${key}`, "content-type": "application/json" }, body: JSON.stringify({ url: signed.signedUrl }),
      });
      if (!res.ok) continue;
      const alt = (await res.json())?.results?.channels?.[0]?.alternatives?.[0];
      const text = alt?.paragraphs?.transcript?.trim() || alt?.transcript?.trim();
      if (text) parts.push(`${labels[qid] ?? qid}:\n${text}`);
    } catch { /* skip this one */ }
  }
  return parts.join("\n\n");
}

export async function submitBlueprint(answers: Answers) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You're signed out. Sign in again and pick up where you left off." };
  const full = await withPrevious(supabase, user.id, answers);
  const { error } = await supabase.from("assessments").upsert({ client_id: user.id, answers: full, submitted_at: new Date().toISOString() }, { onConflict: "client_id" });
  if (error) return { error: "Couldn't send it. Check your connection and try again." };

  // Her numbers go on her profile (only where Michael hasn't set them already).
  const db = adminClient();
  const { data: p } = await db.from("profiles").select("full_name, start_weight_lbs, goal_weight_lbs").eq("id", user.id).single();
  const num = (v: unknown) => (typeof v === "number" && v > 0 ? v : null);
  const patch: Record<string, unknown> = {};
  if (!p?.start_weight_lbs && num(answers.weight_now)) patch.start_weight_lbs = num(answers.weight_now);
  if (!p?.goal_weight_lbs && num(answers.weight_goal)) patch.goal_weight_lbs = num(answers.weight_goal);
  if (Object.keys(patch).length) await db.from("profiles").update(patch).eq("id", user.id);
  if (typeof answers.dob === "string" && /^\d{4}-\d{2}-\d{2}$/.test(answers.dob)) await db.from("profiles").update({ birthday: answers.dob }).eq("id", user.id);

  // November 11: her focus circles, fix-its and starting medals, picked from her answers and her app data.
  let assigned: Awaited<ReturnType<typeof assignFromBlueprint>> | null = null;
  try {
    assigned = await assignFromBlueprint(db, user.id, answers);
    await db.from("assessments").update({ answers: { ...full, assigned } }).eq("client_id", user.id);
  } catch (e) { console.error("blueprint assign", e); }

  // After she sees "done": transcribe her videos, write Michael's summary, and tell him.
  const name = (p?.full_name as string | null) ?? "A new client";
  after(async () => {
    try {
      const transcripts = await transcribe((answers.videos ?? {}) as Record<string, string>);
      const summary = await summarizeBlueprint(answers, transcripts).catch(() => null);
      if (summary || transcripts) await db.from("assessments").update({ ai_summary: [summary, transcripts && `VIDEO ANSWERS (transcribed)\n${transcripts}`].filter(Boolean).join("\n\n") }).eq("client_id", user.id);
    } catch (e) { console.error("blueprint summary", e); }
    const ids = await coachIds();
    if (ids.length) await notify(ids, {
      title: `${name} finished her Driven Woman Blueprint`,
      body: assigned ? `Focus: ${assigned.focus.join(", ")}${assigned.fixits.length ? ` · Fix-its: ${assigned.fixits.join(", ")}` : ""}${assigned.skipped.length ? ` · Skipped ${assigned.skipped.length} medal(s) she's already doing` : ""}` : "Her answers and a summary for your onboarding call are on her page.",
      url: `/coach/clients/${user.id}`,
      email: { subject: `DWTP: ${name} finished her Driven Woman Blueprint`, text: `${name} just finished her Driven Woman Blueprint.\n\nHer answers and a summary for your onboarding call are on her client page.` },
    }).catch(() => {});
  });
  revalidatePath("/today");
  return { ok: true };
}
