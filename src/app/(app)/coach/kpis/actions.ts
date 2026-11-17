"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function coach() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return me?.role === "coach" ? supabase : null;
}

/** What can be saved in each KPI table (anything else is ignored). */
const FIELDS = {
  kpi_expenses: { name: "text", category: "text", amount: "num", frequency: "text", canceling: "bool", notes: "text", position: "int" },
  kpi_slots: { name: "text", rent: "num", plan_2027: "num", plan_note: "text", position: "int" },
  kpi_clients: { name: "text", slot_id: "text", monthly: "num", paid_amount: "num", paid_weeks: "int", expires_on: "date", renewal_offer: "num", notes: "text", position: "int" },
  kpi_payments: { name: "text", client_id: "text", amount: "num", paid_on: "date", notes: "text" },
} as const;
export type KpiTable = keyof typeof FIELDS;

function clean(table: KpiTable, data: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, kind] of Object.entries(FIELDS[table])) {
    if (!(k in data)) continue;
    const v = data[k];
    if (kind === "bool") out[k] = !!v;
    else if (kind === "num" || kind === "int") {
      const s = String(v ?? "").replace(/[$,\s]/g, "");
      const n = s === "" ? null : Number(s);
      out[k] = n === null || Number.isNaN(n) ? (k === "amount" || k === "monthly" || k === "rent" ? 0 : null) : kind === "int" ? Math.round(n) : n;
    } else if (kind === "date") out[k] = /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) ? v : null;
    else out[k] = String(v ?? "").trim().slice(0, 2000) || null;
  }
  return out;
}

/** November 17: add or change one row on the KPIs tab. */
export async function saveKpi(table: KpiTable, id: string | null, data: Record<string, unknown>) {
  const db = await coach();
  if (!db) return { error: "Coach only" };
  if (!(table in FIELDS)) return { error: "Unknown table" };
  const row = clean(table, data);
  if ("name" in FIELDS[table] && !row.name && table !== "kpi_payments") return { error: "Give it a name." };
  const { error } = id ? await db.from(table).update(row).eq("id", id) : await db.from(table).insert(row);
  if (error) return { error: /does not exist|schema cache/i.test(error.message) ? "Run the KPIs SQL file in Supabase first." : error.message };
  revalidatePath("/coach/kpis");
  return { ok: true };
}

export async function deleteKpi(table: KpiTable, id: string) {
  const db = await coach();
  if (!db) return { error: "Coach only" };
  if (!(table in FIELDS)) return { error: "Unknown table" };
  const { error } = await db.from(table).delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/coach/kpis");
  return { ok: true };
}
