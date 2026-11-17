"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/program";
import type { Intensity, Mode } from "@/lib/cycle";

async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from("profiles").select("timezone").eq("id", user.id).single();
  return { supabase, id: user.id, today: todayIn(p?.timezone ?? "America/Los_Angeles") };
}
const isDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
const err = (m: string) => ({ error: /does not exist|schema cache/i.test(m) ? "The cycle tracker isn't switched on yet." : m });
const done = () => { revalidatePath("/", "layout"); return { ok: true as const, error: undefined as string | undefined }; };

/** November 17: turn the cycle tracker on (period, or symptoms only) or off. */
export async function setCycleMode(mode: Mode) {
  const m = await me(); if (!m) return { error: "Not signed in" };
  const { error } = await m.supabase.from("profiles").update({ cycle_tracking: mode === "period" || mode === "symptoms" ? mode : null }).eq("id", m.id);
  return error ? err(error.message) : done();
}

/** Her period started (today, or a day she picks). */
export async function periodStarted(day?: string) {
  const m = await me(); if (!m) return { error: "Not signed in" };
  const d = day && isDay(day) ? day : m.today;
  if (d > m.today) return { error: "That day hasn't happened yet." };
  const { error } = await m.supabase.from("cycle_periods").upsert({ client_id: m.id, start_date: d }, { onConflict: "client_id,start_date", ignoreDuplicates: true });
  return error ? err(error.message) : done();
}

/** Her period ended (today, or a day she picks): closes the latest one that started before it. */
export async function periodEnded(day?: string) {
  const m = await me(); if (!m) return { error: "Not signed in" };
  const d = day && isDay(day) ? day : m.today;
  const { data: last } = await m.supabase.from("cycle_periods").select("start_date").eq("client_id", m.id).lte("start_date", d).order("start_date", { ascending: false }).limit(1).maybeSingle();
  if (!last) return { error: "Log when it started first." };
  const { error } = await m.supabase.from("cycle_periods").update({ end_date: d }).eq("client_id", m.id).eq("start_date", last.start_date);
  return error ? err(error.message) : done();
}

/** A past period, with both days (for when she starts tracking). */
export async function addPastPeriod(start: string, end: string | null) {
  const m = await me(); if (!m) return { error: "Not signed in" };
  if (!isDay(start) || start > m.today) return { error: "Pick the day it started." };
  if (end && (!isDay(end) || end < start)) return { error: "The end day is before the start." };
  const { error } = await m.supabase.from("cycle_periods").upsert({ client_id: m.id, start_date: start, end_date: end || null }, { onConflict: "client_id,start_date" });
  return error ? err(error.message) : done();
}

export async function deletePeriod(start: string) {
  const m = await me(); if (!m) return { error: "Not signed in" };
  const { error } = await m.supabase.from("cycle_periods").delete().eq("client_id", m.id).eq("start_date", start);
  return error ? err(error.message) : done();
}

/** Today's quick check: energy, symptoms, and how hard she chose to lift. */
export async function saveDayLog(patch: { energy?: number | null; symptoms?: string[]; intensity?: Intensity | null }) {
  const m = await me(); if (!m) return { error: "Not signed in" };
  const row: Record<string, unknown> = { client_id: m.id, day: m.today, updated_at: new Date().toISOString() };
  if (patch.energy !== undefined) row.energy = patch.energy && patch.energy >= 1 && patch.energy <= 5 ? Math.round(patch.energy) : null;
  if (patch.symptoms !== undefined) row.symptoms = patch.symptoms.slice(0, 12).map((s) => s.slice(0, 30));
  if (patch.intensity !== undefined) row.intensity = patch.intensity && ["heavy", "normal", "lighter"].includes(patch.intensity) ? patch.intensity : null;
  const { error } = await m.supabase.from("cycle_days").upsert(row, { onConflict: "client_id,day" });
  return error ? err(error.message) : done();
}
