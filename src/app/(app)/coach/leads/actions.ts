"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type LeadInput = { first_name: string; last_name: string; email: string; phone: string; city: string; goals: string; notes: string };

async function coach() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return me?.role === "coach" ? supabase : null;
}
const clean = (l: Partial<LeadInput>) => ({
  first_name: (l.first_name ?? "").trim().slice(0, 80), last_name: (l.last_name ?? "").trim().slice(0, 80),
  email: (l.email ?? "").trim().toLowerCase().slice(0, 200) || null, phone: (l.phone ?? "").trim().slice(0, 40) || null,
  city: (l.city ?? "").trim().slice(0, 120) || null, goals: (l.goals ?? "").trim().slice(0, 2000) || null, notes: (l.notes ?? "").trim().slice(0, 4000) || null,
});
const missingTable = (m: string) => /relation .*leads|does not exist|schema cache/i.test(m) ? "Run the leads SQL file in Supabase first." : m;

/** November 15: add or change one lead. */
export async function saveLead(id: string | null, l: LeadInput) {
  const db = await coach();
  if (!db) return { error: "Coach only" };
  const row = clean(l);
  if (!row.first_name && !row.email && !row.phone) return { error: "Add at least a first name, email or phone." };
  const { error } = id
    ? await db.from("leads").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id)
    : await db.from("leads").insert({ ...row, source: "manual" });
  if (error) return { error: missingTable(error.message) };
  revalidatePath("/coach/leads");
  return { ok: true };
}

export async function deleteLeads(ids: string[]) {
  const db = await coach();
  if (!db) return { error: "Coach only" };
  const { error } = await db.from("leads").delete().in("id", ids);
  if (error) return { error: missingTable(error.message) };
  revalidatePath("/coach/leads");
  return { ok: true };
}

/** An uploaded list. Skips anyone already there (same email or same phone digits). */
export async function importLeads(rows: Partial<LeadInput>[]) {
  const db = await coach();
  if (!db) return { error: "Coach only" };
  const { data: have, error: e0 } = await db.from("leads").select("email, phone");
  if (e0) return { error: missingTable(e0.message) };
  const digits = (p: string | null | undefined) => (p ?? "").replace(/\D/g, "").slice(-10);
  const emails = new Set((have ?? []).map((h) => (h.email as string | null)?.toLowerCase()).filter(Boolean));
  const phones = new Set((have ?? []).map((h) => digits(h.phone as string | null)).filter((p) => p.length === 10));
  const add: ReturnType<typeof clean>[] = [];
  let skipped = 0;
  for (const r of rows.slice(0, 5000)) {
    const c = clean(r);
    if (!c.first_name && !c.email && !c.phone) continue;
    const ph = digits(c.phone);
    if ((c.email && emails.has(c.email)) || (ph.length === 10 && phones.has(ph))) { skipped++; continue; }
    if (c.email) emails.add(c.email);
    if (ph.length === 10) phones.add(ph);
    add.push(c);
  }
  for (let i = 0; i < add.length; i += 500) {
    const { error } = await db.from("leads").insert(add.slice(i, i + 500).map((r) => ({ ...r, source: "upload" })));
    if (error) return { error: missingTable(error.message) };
  }
  revalidatePath("/coach/leads");
  return { ok: true, added: add.length, skipped };
}
