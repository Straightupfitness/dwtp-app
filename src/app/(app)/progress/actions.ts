"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const POSES = ["front", "side", "back", "other"] as const;

/** November 11: a progress photo she just uploaded, on the day she took it. */
export async function addProgressPhoto(path: string, takenOn: string, pose: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  if (!path.startsWith(`${user.id}/`) || !/^\d{4}-\d{2}-\d{2}$/.test(takenOn)) return { error: "Something went wrong. Try again." };
  const { error } = await supabase.from("progress_photos").insert({
    client_id: user.id, path, taken_on: takenOn, pose: (POSES as readonly string[]).includes(pose) ? pose : "front",
  });
  if (error) {
    await supabase.storage.from("progress-photos").remove([path]);
    return { error: "Progress photos aren't switched on yet. Ask Michael." };
  }
  revalidatePath("/progress");
  return { ok: true };
}

export async function deleteProgressPhoto(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const { data } = await supabase.from("progress_photos").select("path").eq("id", id).eq("client_id", user.id).maybeSingle();
  if (!data) return { error: "Photo not found" };
  await supabase.storage.from("progress-photos").remove([data.path]);
  await supabase.from("progress_photos").delete().eq("id", id).eq("client_id", user.id);
  revalidatePath("/progress");
  return { ok: true };
}
