"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadProgram } from "@/lib/circles";
import { closeOutRings } from "@/lib/progress";

async function coach() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").single();
  if (me?.role !== "coach") throw new Error("Coach only");
  return { supabase, coachId: user!.id };
}
const num = (v: FormDataEntryValue | null) => (v === null || String(v).trim() === "" ? null : Number(v));
const str = (v: FormDataEntryValue | null) => (v === null || String(v).trim() === "" ? null : String(v).trim());

export async function updateClient(clientId: string, form: FormData) {
  const { supabase, coachId } = await coach();
  const start = str(form.get("program_start"));
  if (start && new Date(start + "T00:00:00Z").getUTCDay() !== 1) return { error: "The program always starts on a Monday." };
  // Email: her sign-in address too, so change it in her login first.
  const email = str(form.get("email"))?.toLowerCase() ?? null;
  const { data: before } = await supabase.from("profiles").select("email").eq("id", clientId).single();
  if (email && email !== before?.email) {
    if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "That email doesn't look right." };
    const { adminClient, safeError } = await import("@/lib/supabase/admin");
    const { error: authErr } = await adminClient().auth.admin.updateUserById(clientId, { email, email_confirm: true });
    if (authErr) return { error: /already|registered|exists/i.test(authErr.message) ? "Another account already uses that email." : `Couldn't change her email: ${safeError(authErr)}` };
  }
  const { error } = await supabase.from("profiles").update({
    ...(email ? { email } : {}), phone: str(form.get("phone")), timezone: str(form.get("timezone")) ?? "America/Los_Angeles",
    full_name: str(form.get("full_name")), program_start: start, plan: str(form.get("plan")), status: str(form.get("status")) ?? "active",
    start_weight_lbs: num(form.get("start_weight_lbs")), goal_weight_lbs: num(form.get("goal_weight_lbs")),
    strength_days_per_week: num(form.get("strength_days_per_week")),
    ...(str(form.get("workout_program")) ? { workout_program: str(form.get("workout_program")), workout_start_week: Math.max(1, Math.round(num(form.get("workout_start_week")) ?? 1)) } : {}),
    wake_time: str(form.get("wake_time")), bedtime: str(form.get("bedtime")), coach_notes: str(form.get("coach_notes")),
    water_goal_oz: Math.round(num(form.get("water_goal_oz")) ?? 128), step_goal: Math.round(num(form.get("step_goal")) ?? 10000),
  }).eq("id", clientId);
  if (error) return { error: error.message };
  const { error: e2 } = await supabase.from("nutrition_targets").upsert({
    client_id: clientId, maintenance_calories: num(form.get("maintenance_calories")), calorie_target: num(form.get("calorie_target")),
    protein_g: num(form.get("protein_g")), fiber_g: num(form.get("fiber_g")), potassium_mg: num(form.get("potassium_mg")),
    set_by: coachId, updated_at: new Date().toISOString(),
  });
  if (e2) return { error: e2.message };
  revalidatePath(`/coach/clients/${clientId}`);
  revalidatePath("/coach");
  return { ok: true, emailChanged: !!email && email !== before?.email };
}

export async function setFocus(clientId: string, circleIds: string[]) {
  const { supabase } = await coach();
  await supabase.from("client_focus_circles").delete().eq("client_id", clientId);
  if (circleIds.length) await supabase.from("client_focus_circles").insert(circleIds.map((circle_id) => ({ client_id: clientId, circle_id })));
  revalidatePath(`/coach/clients/${clientId}`);
}

/** Open the next ring of a circle for her now, ahead of her plan. */
export async function openNextRing(clientId: string, circleId: string) {
  const { supabase } = await coach();
  const state = await loadProgram(supabase, clientId);
  const c = state.circles.find((x) => x.id === circleId);
  const ring = c?.rings.find((r) => r.status === "upcoming" || r.status === "locked");
  if (!ring) return;
  await supabase.from("client_rings").upsert({ client_id: clientId, ring_id: ring.id, status: "open", opened_on: state.today, opened_early: true },
    { onConflict: "client_id,ring_id" });
  revalidatePath(`/coach/clients/${clientId}`);
}

/** Sign off a Hit item (a milestone from her check-ins). */
export async function signOff(clientId: string, itemId: string) {
  const { supabase, coachId } = await coach();
  const { data: profile } = await supabase.from("profiles").select("timezone").eq("id", clientId).single();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: profile?.timezone ?? "America/Los_Angeles" }).format(new Date());
  await supabase.from("client_items").upsert({ client_id: clientId, item_id: itemId, completed_on: today, signed_off_by: coachId },
    { onConflict: "client_id,item_id" });
  await closeOutRings(supabase, clientId);
  revalidatePath(`/coach/clients/${clientId}`);
}

/** Send (or re-send) her welcome email with a fresh one-tap link. */
export async function resendWelcome(clientId: string) {
  await coach();
  const { adminClient } = await import("@/lib/supabase/admin");
  const { sendWelcome } = await import("@/lib/invite");
  const { data: p } = await adminClient().from("profiles").select("email, full_name").eq("id", clientId).single();
  if (!p?.email) return { ok: false };
  return { ok: await sendWelcome(clientId, p.email, p.full_name) };
}

/** What she bought, how much she paid, and when it starts and expires (typed in by Michael). */
export async function addPurchase(clientId: string, form: FormData) {
  const { supabase } = await coach();
  const offer = str(form.get("offer"));
  if (!offer) return { error: "Say what she bought." };
  const { error } = await supabase.from("client_purchases").insert({
    client_id: clientId, offer, amount_paid: num(form.get("amount_paid")), purchased_on: str(form.get("purchased_on")),
    starts_on: str(form.get("starts_on")), expires_on: str(form.get("expires_on")), notes: str(form.get("notes")),
  });
  if (error) return { error: error.message };
  revalidatePath(`/coach/clients/${clientId}`);
  return { ok: true };
}

export async function deletePurchase(clientId: string, id: string) {
  const { supabase } = await coach();
  await supabase.from("client_purchases").delete().eq("id", id).eq("client_id", clientId);
  revalidatePath(`/coach/clients/${clientId}`);
}
