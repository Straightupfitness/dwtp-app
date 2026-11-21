"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { makeCaptions } from "@/lib/ai/captions";
import { createClient } from "@/lib/supabase/server";
import { VIDEO_CODE } from "@/lib/videos";

async function coach() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return me?.role === "coach" ? supabase : null;
}

/** After the browser uploads a file to program-videos/<code>.mp4, record it. */
export async function registerVideo(v: { code: string; path: string; portrait: boolean | null; seconds: number | null; bytes: number }) {
  const supabase = await coach();
  if (!supabase) return { error: "Coach only" };
  if (!VIDEO_CODE.test(v.code)) return { error: `${v.code} isn't a video code` };
  const { error } = await supabase.from("program_videos").upsert({ ...v, uploaded_at: new Date().toISOString() }, { onConflict: "code" });
  if (error) return { error: /program_videos|relation|schema cache/i.test(error.message) ? "Run SQL 16 (program videos) in Supabase first." : error.message };
  revalidatePath("/coach/videos");
  // November 21: captions are made in the background right after every upload.
  after(async () => { const r = await makeCaptions(adminClient(), v.code); if (r.error) console.error("captions", v.code, r.error); });
  return { ok: true };
}

export async function removeVideo(code: string) {
  const supabase = await coach();
  if (!supabase) return { error: "Coach only" };
  const { data } = await supabase.from("program_videos").select("path").eq("code", code).maybeSingle();
  if (data?.path) await supabase.storage.from("program-videos").remove([data.path as string]);
  await supabase.from("program_videos").delete().eq("code", code);
  revalidatePath("/coach/videos");
  return { ok: true };
}

/** November 21: makes captions for the next video that doesn't have them yet. Returns how many are left. */
export async function captionNext() {
  const supabase = await coach();
  if (!supabase) return { error: "Coach only" };
  const db = adminClient();
  const { data, error } = await db.from("program_videos").select("code").is("captions_at", null).order("code").limit(1);
  if (error) return { error: /captions/.test(error.message) ? "Run SQL 40 (video captions) in Supabase first." : error.message };
  if (!data?.length) return { left: 0 };
  const code = data[0].code as string;
  const r = await makeCaptions(db, code);
  if (r.error) { await db.from("program_videos").update({ captions_at: new Date().toISOString() }).eq("code", code); }
  const { count } = await db.from("program_videos").select("code", { count: "exact", head: true }).is("captions_at", null);
  return { code, lines: r.lines ?? 0, error: r.error, left: count ?? 0 };
}

/** Remake one video's captions (e.g. after fixing a word Deepgram misheard by re-recording). */
export async function recaption(code: string) {
  const supabase = await coach();
  if (!supabase) return { error: "Coach only" };
  return makeCaptions(adminClient(), code);
}
