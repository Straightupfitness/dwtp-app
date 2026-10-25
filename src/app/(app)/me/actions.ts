"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updateName(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const name = String(form.get("full_name") ?? "").trim();
  if (!user || !name) return;
  await supabase.from("profiles").update({ full_name: name }).eq("id", user.id);
  revalidatePath("/", "layout");
}

export async function setEmailNotifications(on: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("profiles").update({ email_notifications: on }).eq("id", user.id);
  revalidatePath("/me");
}

/** Save her new profile picture (already uploaded to avatars/<her id>/…) and remove the old one. */
export async function setAvatar(path: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || (path && !path.startsWith(`${user.id}/`))) return;
  const { data: p } = await supabase.from("profiles").select("avatar_path").eq("id", user.id).single();
  await supabase.from("profiles").update({ avatar_path: path }).eq("id", user.id);
  if (p?.avatar_path && p.avatar_path !== path) await supabase.storage.from("avatars").remove([p.avatar_path]);
  revalidatePath("/", "layout");
}
