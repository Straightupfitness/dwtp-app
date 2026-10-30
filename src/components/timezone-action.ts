"use server";
import { createClient } from "@/lib/supabase/server";

/** Save her phone's time zone (a real IANA zone like "America/New_York"). */
export async function setMyTimezone(tz: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); } catch { return { error: "Unknown time zone" }; }
  if (!/^[A-Za-z_]+\/[A-Za-z_\-/]+$/.test(tz) && tz !== "UTC") return { error: "Unknown time zone" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const { error } = await supabase.from("profiles").update({ timezone: tz }).eq("id", user.id);
  return error ? { error: error.message } : { ok: true };
}
