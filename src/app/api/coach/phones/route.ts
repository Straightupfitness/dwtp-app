import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

/**
 * November 13: fill in clients' phone numbers in bulk from a list of names (coach only). Matches by full name, then
 * by last name + first name overlap ("Patricia Gil" → "Tricia Gil"), then by first name + last initial ("Daisy I.").
 * Never overwrites a number that's already there; reports it instead. `dryRun` shows the matches without saving.
 */
type Row = { name: string; phone: string };
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
const e164 = (p: string) => { const d = p.replace(/\D/g, ""); return d.length === 10 ? `+1${d}` : d.length === 11 && d.startsWith("1") ? `+${d}` : null; };

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "coach") return NextResponse.json({ error: "Coach only" }, { status: 403 });
  const { rows, dryRun } = (await req.json()) as { rows: Row[]; dryRun?: boolean };
  const db = adminClient();
  const { data: clients } = await db.from("profiles").select("id, full_name, phone, status").eq("role", "client");
  const list = (clients ?? []).map((c) => { const n = norm((c.full_name as string) ?? ""); const parts = n.split(" "); return { ...c, n, first: parts[0] ?? "", last: parts.slice(1).join(" ") }; });

  const out = { set: [] as string[], already: [] as string[], different: [] as string[], unmatched: [] as string[], ambiguous: [] as string[], badNumber: [] as string[] };
  for (const r of rows) {
    const phone = e164(r.phone);
    if (!phone) { out.badNumber.push(`${r.name} (${r.phone})`); continue; }
    const n = norm(r.name), parts = n.split(" "), first = parts[0], last = parts.slice(1).join(" ");
    let m = list.filter((c) => c.n === n);
    if (!m.length && last) m = list.filter((c) => c.last === last && (c.first.includes(first) || first.includes(c.first)));
    if (!m.length && last) m = list.filter((c) => c.first === first && c.last.length <= 2 && last.startsWith(c.last));
    if (!m.length) m = list.filter((c) => c.first === first && (!last || c.last === "")).length === 1 ? list.filter((c) => c.first === first && (!last || c.last === "")) : [];
    if (m.length === 0) { out.unmatched.push(r.name); continue; }
    if (m.length > 1) { out.ambiguous.push(`${r.name} → ${m.map((c) => c.full_name).join(" / ")}`); continue; }
    const c = m[0];
    const label = r.name === c.full_name ? r.name : `${r.name} → ${c.full_name}`;
    if (c.phone && e164(c.phone as string) === phone) { out.already.push(label); continue; }
    if (c.phone) { out.different.push(`${label} (app has ${c.phone})`); continue; }
    if (!dryRun) { const { error } = await db.from("profiles").update({ phone }).eq("id", c.id); if (error) { out.badNumber.push(`${label}: ${error.message}`); continue; } }
    out.set.push(label);
  }
  return NextResponse.json(out);
}
