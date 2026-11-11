import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "./daily";
import { todayIn } from "./program";

/**
 * November 11: when she sends her Driven Woman Blueprint, the app picks her lowest-hanging fruit by itself.
 *
 * 1. Three focus circles, scored from her answers (doc 23, section 8): Circadian Reset, Food Philosophy and Cardio by
 *    default; Mindset steps in for high stress; Circadian Reset steps aside when her sleep and energy are already good.
 * 2. Fix-its open for what she told us about (knees, feet, shoulders, hips, menopause symptoms, regular travel).
 * 3. Momentum: medals she's clearly already doing in the app (logging food and weight, steps) are marked done so she
 *    doesn't start at the very beginning, and the next medal opens.
 * Michael sees what it picked (and why) on her page, and can change any of it.
 */
export type Assignment = { focus: string[]; fixits: string[]; skipped: string[]; reasons: string[]; at: string };

type A = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : null);
const list = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);
const hour = (t: unknown) => (typeof t === "string" && /^\d{2}:\d{2}/.test(t) ? Number(t.slice(0, 2)) + Number(t.slice(3, 5)) / 60 : null);

export async function assignFromBlueprint(db: SupabaseClient, clientId: string, a: A): Promise<Assignment> {
  const reasons: string[] = [];
  const { data: p } = await db.from("profiles").select("timezone, program_start").eq("id", clientId).single();
  const today = todayIn((p?.timezone as string | null) ?? "America/Los_Angeles");
  const since = addDays(today, -13);

  // Her last 14 days in the app.
  const [{ data: meals }, { data: weights }, { data: steps }, { data: circles }, { data: rings }] = await Promise.all([
    db.from("food_logs").select("eaten_at").eq("client_id", clientId).gte("eaten_at", since + "T00:00:00Z"),
    db.from("weight_logs").select("log_date").eq("client_id", clientId).gte("log_date", since),
    db.from("health_days").select("day, steps").eq("client_id", clientId).gte("day", since).not("steps", "is", null),
    db.from("circles").select("id, slug, name, kind"),
    db.from("rings").select("id, circle_id, ring_number, name"),
  ]);
  const { data: mine } = await db.from("client_rings").select("ring_id, status").eq("client_id", clientId);
  const doneAlready = new Set((mine ?? []).filter((r) => r.status === "complete").map((r) => r.ring_id as string));
  const foodDays = new Set((meals ?? []).map((m) => String(m.eaten_at).slice(0, 10))).size;
  const weighDays = new Set((weights ?? []).map((w) => w.log_date as string)).size;
  const stepVals = (steps ?? []).map((s) => s.steps as number).filter((s) => s > 0);
  const avgSteps = stepVals.length >= 5 ? Math.round(stepVals.reduce((x, y) => x + y, 0) / stepVals.length) : null;

  // 1. Focus circles.
  const sleep = num(a.sleep), energy = num(a.energy), stress = num(a.stress);
  const wake = String(a.wakeups_3am ?? ""), crash = String(a.afternoon_crash ?? "");
  const caffeine = String(a.caffeine_drinks ?? ""), lastCaff = String(a.caffeine_last ?? "");
  const bed = hour(a.bed_weekday);
  const lateBed = bed !== null && (bed >= 23 || bed < 4);
  let circadian = 0;
  if (sleep !== null && sleep <= 6) { circadian += 3; reasons.push(`Sleep ${sleep}/10`); }
  if (wake === "3–4" || wake === "5–7") { circadian += 2; reasons.push(`3 AM wakeups ${wake} nights a week`); }
  if (energy !== null && energy <= 6) { circadian += 2; reasons.push(`Energy ${energy}/10`); }
  if (crash === "Most days") { circadian += 1; reasons.push("Afternoon crash most days"); }
  if (["3", "4+"].includes(caffeine) || ["2–4 PM", "After 4 PM"].includes(lastCaff)) { circadian += 1; reasons.push(`Caffeine: ${caffeine} a day, last ${lastCaff}`); }
  if (lateBed) { circadian += 1; reasons.push(`Bedtime ${a.bed_weekday}`); }
  const sleepGood = (sleep ?? 0) >= 8 && (energy ?? 0) >= 8 && (wake === "0" || wake === "1–2");
  const scores: Record<string, number> = {
    "circadian-reset": sleepGood ? 0.5 : Math.max(circadian, 2.5), // the default focus unless her sleep and energy are already good
    "food-philosophy": 3,
    cardio: avgSteps === null ? 2 : avgSteps < 6000 ? 2.5 : avgSteps < 8000 ? 2 : 1,
    mindset: stress !== null && stress >= 7 ? 3.2 : stress !== null && stress >= 6 ? 1.2 : 0,
    strength: 0.8,
  };
  if (stress !== null && stress >= 7) reasons.push(`Stress ${stress}/10`);
  if (sleepGood) reasons.push(`Sleep ${sleep} and energy ${energy} are already good, so Circadian Reset isn't a focus`);
  const order = ["circadian-reset", "food-philosophy", "cardio", "mindset", "strength"];
  const focusSlugs = [...order].sort((x, y) => scores[y] - scores[x] || order.indexOf(x) - order.indexOf(y)).slice(0, 3);

  // 2. Fix-its.
  const pain = list(a.pain), meno = list(a.menopause);
  const fixSlugs: string[] = [];
  if (pain.includes("Knees")) fixSlugs.push("knees");
  if (pain.includes("Feet or heels")) fixSlugs.push("plantar-fasciitis");
  if (pain.includes("Shoulders")) fixSlugs.push("shoulder");
  if (pain.includes("Hips")) fixSlugs.push("hips");
  if (meno.some((m) => !["None", "Not sure"].includes(m))) fixSlugs.push("menopause");
  if (["About once a month", "Every week"].includes(String(a.travel ?? ""))) fixSlugs.push("travel");

  const bySlug = new Map((circles ?? []).map((c) => [c.slug as string, c]));
  const ringOf = (slug: string, n: number) => (rings ?? []).find((r) => r.circle_id === bySlug.get(slug)?.id && r.ring_number === n);
  const opened = (p?.program_start as string | null) && (p!.program_start as string) > today ? (p!.program_start as string) : today;

  const focusIds = focusSlugs.map((s) => bySlug.get(s)?.id).filter(Boolean) as string[];
  await db.from("client_focus_circles").delete().eq("client_id", clientId);
  if (focusIds.length) await db.from("client_focus_circles").insert(focusIds.map((circle_id) => ({ client_id: clientId, circle_id })));

  const open = async (slug: string, n: number) => {
    const r = ringOf(slug, n);
    if (r) await db.from("client_rings").upsert({ client_id: clientId, ring_id: r.id, status: "open", opened_on: opened, opened_early: true }, { onConflict: "client_id,ring_id", ignoreDuplicates: true });
  };
  for (const s of fixSlugs) await open(s, 1);

  // 3. Momentum: skip what she's already doing.
  const skipped: string[] = [];
  const skip = async (slug: string, n: number, why: string) => {
    const r = ringOf(slug, n);
    if (!r) return;
    if (doneAlready.has(r.id as string)) { await open(slug, n + 1); return; } // already done: just make sure the next one is open
    await db.from("client_rings").upsert({ client_id: clientId, ring_id: r.id, status: "complete", opened_on: addDays(today, -14), completed_on: today }, { onConflict: "client_id,ring_id" });
    await open(slug, n + 1);
    skipped.push(`${bySlug.get(slug)?.name} · ${r.name} (${why})`);
  };
  if (foodDays >= 10 && weighDays >= 10) await skip("food-philosophy", 1, `logged food ${foodDays} and weight ${weighDays} of the last 14 days`);
  if (avgSteps !== null && avgSteps >= 6000) await skip("cardio", 1, `averaging ${avgSteps.toLocaleString()} steps`);
  if (avgSteps !== null && avgSteps >= 8000) await skip("cardio", 2, `averaging ${avgSteps.toLocaleString()} steps`);

  return {
    focus: focusSlugs.map((s) => (bySlug.get(s)?.name as string) ?? s),
    fixits: fixSlugs.map((s) => (bySlug.get(s)?.name as string) ?? s),
    skipped, reasons, at: new Date().toISOString(),
  };
}
