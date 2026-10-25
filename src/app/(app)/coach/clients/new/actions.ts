"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminClient, safeError } from "@/lib/supabase/admin";
import { sendWelcome } from "@/lib/invite";

/** Michael adds a client: creates her login (no password; she signs in with an email link) and her profile. */
export async function addClient(_: unknown, form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").single();
  if (me?.role !== "coach") return { error: "Coach only" };

  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const name = String(form.get("full_name") ?? "").trim();
  const start = String(form.get("program_start") ?? "").trim() || null;
  const num = (k: string) => { const v = String(form.get(k) ?? "").trim(); return v ? Number(v) : null; };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email." };
  if (!name) return { error: "Enter her name." };
  if (start && new Date(start + "T00:00:00Z").getUTCDay() !== 1) return { error: "The program always starts on a Monday." };

  let db, created, error;
  try {
    db = adminClient();
    ({ data: created, error } = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: name } }));
  } catch (e) {
    console.error("add client failed", safeError(e));
    return { error: /header|invalid|key/i.test(String(e)) ? "Setup: SUPABASE_SERVICE_ROLE_KEY in Vercel isn't valid. Re-paste it (no spaces or line breaks) and redeploy." : `Couldn't add her: ${safeError(e)}` };
  }
  if (error) return { error: /already|registered|exists/i.test(error.message) ? "There's already an account with that email." : `Couldn't add her: ${safeError(error)}` };
  const id = created.user!.id;
  await db.from("profiles").upsert({
    id, email, full_name: name, role: "client", status: start ? "active" : "onboarding", program_start: start,
    plan: String(form.get("plan") ?? "") || null, start_weight_lbs: num("start_weight_lbs"), goal_weight_lbs: num("goal_weight_lbs"),
  });

  if (form.get("send_welcome") === "on") {
    const sent = await sendWelcome(id, email, name).catch((e) => { console.error("welcome failed", safeError(e)); return false; });
    if (!sent) redirect(`/coach/clients/${id}?welcome=failed`);
  }
  redirect(`/coach/clients/${id}`);
}
