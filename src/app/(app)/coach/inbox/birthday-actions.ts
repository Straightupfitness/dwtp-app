"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

/** Michael turns the automatic birthday message on or off, and sets its words (November 2). */
export async function saveBirthdaySettings(on: boolean, message: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  if (me?.role !== "coach") return { error: "Coach only" };
  const text = message.trim().slice(0, 500);
  if (on && !text) return { error: "Write the message first." };
  const { error } = await adminClient().from("app_config").upsert([{ key: "birthday_on", value: on ? "on" : "off" }, { key: "birthday_message", value: text }], { onConflict: "key" });
  if (error) return { error: error.message };
  revalidatePath("/coach/inbox");
  return { ok: true };
}
