"use server";
import { revalidatePath } from "next/cache";
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
