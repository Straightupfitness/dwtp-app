"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function coach() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").single();
  if (me?.role !== "coach") throw new Error("Coach only");
  return supabase;
}
const done = () => { revalidatePath("/calendar"); revalidatePath("/coach/calendar"); };
const url = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
};

export async function saveLinks(form: FormData) {
  const supabase = await coach();
  for (const key of ["rtt_zoom_url", "trainerize_url", "health_shortcut_url"]) {
    await supabase.from("program_settings").upsert({ key, value: url(form.get(key)) });
  }
  done();
  return { ok: true };
}

export async function saveCall(form: FormData) {
  const supabase = await coach();
  const date = String(form.get("call_date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Missing date" };
  const row = { call_date: date, title: String(form.get("title") ?? "").trim() || null, replay_url: url(form.get("replay_url")),
    cancelled: form.get("cancelled") === "on", updated_at: new Date().toISOString() };
  const { data: before } = await supabase.from("calls").select("post_id").eq("call_date", date).maybeSingle();
  const { error } = row.title || row.replay_url || row.cancelled
    ? await supabase.from("calls").upsert(row)
    : await supabase.from("calls").delete().eq("call_date", date);
  if (error) return { error: error.message };
  // A replay pasted by hand gets the same Community post and notification as one from Zoom.
  if (row.replay_url && !row.cancelled && !before?.post_id) {
    const { publishReplay } = await import("@/lib/replays");
    const { zonedInstant } = await import("@/lib/checkin");
    await publishReplay({ url: row.replay_url, startedAt: new Date(zonedInstant(date, 16, "America/Los_Angeles").getTime() + 30 * 60_000).toISOString() });
  }
  done();
  revalidatePath("/community");
  return { ok: true };
}
