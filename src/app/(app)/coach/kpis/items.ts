"use server";
import { createClient } from "@/lib/supabase/server";

/** November 19: one line of Michael's planner (the action plan, the Eisenhower matrix, or his outline). */
export type PlanItem = {
  id: string; kind: "action" | "matrix" | "outline"; parent_id: string | null; text: string; note: string | null;
  quadrant: number | null; position: number; done: boolean; collapsed: boolean;
  sched_at?: string | null; sched_minutes?: number | null; // November 20: on the scheduler (when, and how long)
};

async function coach() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return me?.role === "coach" ? supabase : null;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Save (add or change) planner lines. No revalidate: the screen already shows the change. */
export async function saveItems(rows: PlanItem[]) {
  const db = await coach();
  if (!db) return { error: "Coach only" };
  const clean = rows.filter((r) => UUID.test(r.id) && ["action", "matrix", "outline"].includes(r.kind)).map((r) => ({
    id: r.id, kind: r.kind, parent_id: r.parent_id && UUID.test(r.parent_id) ? r.parent_id : null, text: String(r.text ?? "").slice(0, 5000),
    note: r.note ? String(r.note).slice(0, 10000) : null, quadrant: r.quadrant == null || r.kind === "action" ? (r.kind === "matrix" ? 1 : null) : Math.min(4, Math.max(1, Math.round(Number(r.quadrant) || 1))), // November 20: outline lines carry their box too
    position: Number.isFinite(Number(r.position)) ? Number(r.position) : 0, done: !!r.done, collapsed: !!r.collapsed, updated_at: new Date().toISOString(),
    ...(r.sched_at !== undefined ? { sched_at: r.sched_at && !Number.isNaN(Date.parse(r.sched_at)) ? new Date(r.sched_at).toISOString() : null,
      sched_minutes: r.sched_at ? Math.min(720, Math.max(15, Math.round(Number(r.sched_minutes) || 60))) : null } : {}),
  }));
  if (!clean.length) return { ok: true };
  // Parents first, so a new line's parent exists before it does.
  const ids = new Set(clean.map((r) => r.id));
  const depth = (r: (typeof clean)[number], seen = 0): number => { const p = r.parent_id && ids.has(r.parent_id) ? clean.find((x) => x.id === r.parent_id) : null; return p && seen < 50 ? 1 + depth(p, seen + 1) : 0; };
  clean.sort((a, b) => depth(a) - depth(b));
  const { error } = await db.from("kpi_items").upsert(clean);
  if (error) return { error: /does not exist|schema cache/i.test(error.message) ? "Run the 32 KPI planner SQL file in Supabase first." : error.message };
  return { ok: true };
}

/** Delete planner lines (a line's children go with it). */
export async function deleteItems(ids: string[]) {
  const db = await coach();
  if (!db) return { error: "Coach only" };
  const ok = ids.filter((i) => UUID.test(i));
  if (!ok.length) return { ok: true };
  const { error } = await db.from("kpi_items").delete().in("id", ok);
  return error ? { error: error.message } : { ok: true };
}

/** November 20: something on his calendar that comes back every week or every year (a birthday). */
export type CalEvent = {
  id: string; title: string; kind: "weekly" | "yearly"; weekday: number | null; month: number | null; day: number | null;
  start_min: number | null; minutes: number; icon: string | null; note: string | null;
};

export async function saveEvent(id: string | null, e: Omit<CalEvent, "id">) {
  const db = await coach();
  if (!db) return { error: "Coach only" };
  const int = (v: unknown, lo: number, hi: number) => { const x = Math.round(Number(v)); return Number.isFinite(x) && x >= lo && x <= hi ? x : null; };
  const row = {
    title: String(e.title ?? "").trim().slice(0, 200), kind: e.kind === "yearly" ? "yearly" : "weekly",
    weekday: e.kind === "weekly" ? int(e.weekday, 0, 6) : null, month: e.kind === "yearly" ? int(e.month, 1, 12) : null, day: e.kind === "yearly" ? int(e.day, 1, 31) : null,
    start_min: e.start_min == null || (e.start_min as unknown) === "" ? null : int(e.start_min, 0, 1439), minutes: int(e.minutes, 5, 720) ?? 60,
    icon: e.icon ? String(e.icon).slice(0, 8) : null, note: e.note ? String(e.note).trim().slice(0, 500) || null : null,
  };
  if (!row.title) return { error: "Give it a name." };
  if (row.kind === "weekly" && row.weekday === null) return { error: "Pick a day of the week." };
  if (row.kind === "yearly" && (row.month === null || row.day === null)) return { error: "Pick the date." };
  const { data, error } = id ? await db.from("kpi_events").update(row).eq("id", id).select("id").single() : await db.from("kpi_events").insert(row).select("id").single();
  if (error) return { error: /does not exist|schema cache/i.test(error.message) ? "Run the 37 calendar events SQL file in Supabase first." : error.message };
  return { ok: true, id: (data?.id as string) ?? id };
}

export async function deleteEvent(id: string) {
  const db = await coach();
  if (!db) return { error: "Coach only" };
  const { error } = await db.from("kpi_events").delete().eq("id", id);
  return error ? { error: error.message } : { ok: true };
}
