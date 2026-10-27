import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { adminClient } from "@/lib/supabase/admin";
import { loadProgram } from "@/lib/circles";
import { awardAutoHabit, closeOutRings } from "@/lib/progress";
import { todayIn } from "@/lib/program";
import { num, threshold } from "@/lib/health-parse";

const hash = (t: string) => createHash("sha256").update(t.trim().toUpperCase()).digest("hex");
const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);

/** A new sync code for her Shortcut (the old one stops working). Easy to type: 8 letters and digits, no 0/O or 1/I. */
export async function newHealthCode(userId: string) {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = Array.from(randomBytes(8), (b) => abc[b % abc.length]).join("");
  await adminClient().from("health_tokens").upsert({ user_id: userId, token_hash: hash(code), created_at: new Date().toISOString(), last_used_at: null });
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export type HealthInput = { code: string; date?: string; steps?: unknown; sleep_hours?: unknown; sleep_minutes?: unknown; weight?: unknown; weight_unit?: string };

/**
 * Data from her iPhone Shortcut. Saves steps and sleep for the day, adds a weigh-in if she hasn't logged one,
 * and checks off any open step, sleep or weigh-in habit she reached (+1 CP each, once).
 */
export async function syncHealth(input: HealthInput) {
  const db = adminClient();
  const code = String(input.code ?? "").replace(/[^A-Za-z0-9]/g, "");
  if (code.length < 8) return { error: "Missing your sync code. Get it in the DWTP app under Me." };
  const { data: tok } = await db.from("health_tokens").select("user_id").eq("token_hash", hash(code)).maybeSingle();
  if (!tok) return { error: "That sync code doesn't match. Get a new one in the DWTP app under Me." };
  const userId = tok.user_id as string;
  const { data: p } = await db.from("profiles").select("timezone").eq("id", userId).single();
  const today = todayIn(p?.timezone ?? "America/Los_Angeles");
  const day = input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) && input.date <= today && input.date >= addDays(today, -7) ? input.date : today;

  const steps = num(input.steps);
  const sleepMin: number = (input.sleep_minutes !== undefined && input.sleep_minutes !== "" ? num(input.sleep_minutes) : (num(input.sleep_hours) ?? NaN) * 60) ?? NaN;
  let weight = num(input.weight);
  if (weight && (/kg/i.test(String(input.weight_unit ?? "")) || /kg/i.test(String(input.weight)))) weight = Math.round(weight * 2.20462 * 10) / 10;

  const clean = {
    steps: steps !== null && steps >= 0 && steps < 150_000 ? Math.round(steps) : null,
    sleep: Number.isFinite(sleepMin) && sleepMin > 0 && sleepMin < 16 * 60 ? Math.round(sleepMin) : null,
    weight: weight && weight >= 60 && weight <= 600 ? Math.round(weight * 10) / 10 : null,
  };

  // Keep the highest step count for the day (the Shortcut may run more than once); sleep and the latest weight replace.
  const { data: before } = await db.from("health_days").select("steps, sleep_minutes").eq("client_id", userId).eq("day", day).maybeSingle();
  const daySteps = Math.max(before?.steps ?? 0, clean.steps ?? 0) || null;
  const daySleep = clean.sleep ?? before?.sleep_minutes ?? null;
  await db.from("health_days").upsert({ client_id: userId, day, steps: daySteps, sleep_minutes: daySleep, source: "apple-shortcut", synced_at: new Date().toISOString() });

  let weighed = false;
  if (clean.weight) {
    const { data: w } = await db.from("weight_logs").select("log_date").eq("client_id", userId).eq("log_date", day).maybeSingle();
    if (!w) { await db.from("weight_logs").insert({ client_id: userId, log_date: day, weight_lbs: clean.weight }); weighed = true; }
    await awardAutoHabit(db, userId, "weigh-in", day);
  }

  // Check off open step and sleep habits she reached.
  const checked: string[] = [];
  const state = await loadProgram(db, userId);
  for (const c of state.circles) for (const r of c.rings) {
    if (r.status !== "open") continue;
    for (const it of r.items) {
      const th = threshold(it.title);
      if (!th) continue;
      const value = th.kind === "steps" ? daySteps : daySleep;
      if (!value || value < th.min) continue;
      const { data: linked } = it.habitKey ? await db.from("ring_items").select("id").eq("habit_key", it.habitKey) : { data: [{ id: it.id }] };
      const ids = (linked ?? [{ id: it.id }]).map((x) => x.id as string);
      await db.from("habit_logs").upsert(ids.map((id) => ({ client_id: userId, item_id: id, log_date: day, done: true })));
      const { data: had } = await db.from("cp_ledger").select("id").eq("client_id", userId).eq("reason", `habit:${day}`).in("source_id", ids).limit(1).maybeSingle();
      if (!had) await db.from("cp_ledger").insert({ client_id: userId, points: 1, reason: `habit:${day}`, source_id: it.id });
      checked.push(it.title);
    }
  }
  if (checked.length || weighed) await closeOutRings(db, userId);
  await db.from("health_tokens").update({ last_used_at: new Date().toISOString() }).eq("user_id", userId);

  const parts = [daySteps !== null && `${daySteps.toLocaleString("en-US")} steps`, daySleep !== null && `${(daySleep / 60).toFixed(1)} h sleep`,
    clean.weight && `${clean.weight} lbs`].filter(Boolean);
  return { ok: true, message: parts.length ? `Synced to DWTP: ${parts.join(", ")}.${checked.length ? ` ${checked.length} habit${checked.length > 1 ? "s" : ""} checked off.` : ""}` : "Connected to DWTP, but your phone sent no steps, sleep or weight." };
}
