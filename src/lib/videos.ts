import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./supabase/config";

/**
 * Michael's program videos (November 9). Each has a code that is also its file name: ONB-01, 7X-05, CHK-02, MED-14.
 * They live in the public program-videos bucket; program_videos says which ones are uploaded.
 */
export type ProgramVideo = { code: string; url: string; portrait: boolean | null; seconds: number | null };

export const VIDEO_CODE = /^(ONB|7X|CHK|MED|HH|SBW|SMF|SUP|FAQ)-(\d{1,3})$/;

/** The codes Michael has scripts for, grouped the way he records them. */
export const VIDEO_SETS: { title: string; prefix: string; codes: string[] }[] = [
  { title: "Onboarding", prefix: "ONB", codes: ["ONB-01"] },
  { title: "Driven Woman Blueprint", prefix: "7X", codes: Array.from({ length: 19 }, (_, i) => `7X-${String(i + 1).padStart(2, "0")}`) },
  { title: "Check-ins", prefix: "CHK", codes: Array.from({ length: 28 }, (_, i) => `CHK-${String(i + 1).padStart(2, "0")}`).filter((c) => c !== "CHK-27") },
  { title: "Medals", prefix: "MED", codes: Array.from({ length: 50 }, (_, i) => `MED-${String(i + 1).padStart(2, "0")}`) },
  { title: "Habits & Homework", prefix: "HH", codes: Array.from({ length: 26 }, (_, i) => `HH-${String(i + 1).padStart(2, "0")}`) },
  { title: "Strong Body Wednesday (by week)", prefix: "SBW", codes: Array.from({ length: 26 }, (_, i) => `SBW-${String(i + 1).padStart(2, "0")}`) },
];

/** "chk 2.mp4", "CHK-02 final.mov" → "CHK-02". Null when the name has no code. */
export function codeFromFileName(name: string): string | null {
  const m = name.toUpperCase().match(/\b(ONB|7X|CHK|MED|HH|SBW|SMF|SUP|FAQ)[\s_-]*0*(\d{1,3})\b/);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}` : null;
}

export const videoPublicUrl = (path: string, version?: string) =>
  `${supabaseUrl()}/storage/v1/object/public/program-videos/${path}${version ? `?v=${encodeURIComponent(version)}` : ""}`;

/** Every uploaded video, by code (tolerates the table not existing yet). */
export async function loadVideos(supabase: SupabaseClient, prefix?: string): Promise<Map<string, ProgramVideo>> {
  let q = supabase.from("program_videos").select("code, path, portrait, seconds, uploaded_at");
  if (prefix) q = q.like("code", `${prefix}-%`);
  const { data } = await q;
  return new Map((data ?? []).map((v) => [v.code as string, {
    code: v.code as string, url: videoPublicUrl(v.path as string, v.uploaded_at as string), portrait: v.portrait as boolean | null, seconds: v.seconds as number | null,
  }]));
}
