import type { SupabaseClient } from "@supabase/supabase-js";

export type ProgressPhoto = { id: string; takenOn: string; pose: string; url: string };

/** Her progress photos, oldest first, with links good for an hour. Empty before migration 0040. */
export async function loadProgressPhotos(supabase: SupabaseClient, clientId: string): Promise<ProgressPhoto[]> {
  const { data, error } = await supabase.from("progress_photos").select("id, taken_on, pose, path, created_at")
    .eq("client_id", clientId).order("taken_on").order("created_at");
  if (error || !data?.length) return [];
  const { data: signed } = await supabase.storage.from("progress-photos").createSignedUrls(data.map((p) => p.path as string), 3600);
  const url = new Map((signed ?? []).filter((s) => s.path && s.signedUrl).map((s) => [s.path as string, s.signedUrl as string]));
  return data.filter((p) => url.has(p.path as string)).map((p) => ({ id: p.id as string, takenOn: p.taken_on as string, pose: p.pose as string, url: url.get(p.path as string)! }));
}
