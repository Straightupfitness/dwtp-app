"use server";
import { createClient } from "@/lib/supabase/server";
import type { GoItem } from "@/lib/go-to";

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) / 1000 : null; };
const txt = (v: unknown, max = 80) => String(v ?? "").trim().slice(0, max);

/** November 26: save one of her go-to meals (1–3 main, 4–6 backups). Saved as she types. */
export async function saveGoMeal(position: number, name: string, items: GoItem[], currency: string, clientId?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  if (!(position >= 1 && position <= 6)) return { error: "Bad meal" };
  const clean = (items ?? []).slice(0, 25).map((i) => ({
    name: txt(i.name), qty: num(i.qty), unit: txt(i.unit, 20), brand: txt(i.brand), store: txt(i.store),
    pkg_qty: num(i.pkg_qty), pkg_price: num(i.pkg_price), kcal: num(i.kcal), protein: num(i.protein), fiber: num(i.fiber),
  }));
  const { error } = await supabase.from("go_to_meals").upsert({
    client_id: clientId ?? user.id, position, name: txt(name, 60) || null, items: clean, currency: txt(currency, 4) || "$", updated_at: new Date().toISOString(),
  }, { onConflict: "client_id,position" });
  if (error) return { error: /go_to_meals/.test(error.message) ? "This isn't switched on yet." : error.message };
  return { ok: true };
}

export async function deleteGoMeal(position: number, clientId?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const { error } = await supabase.from("go_to_meals").delete().eq("client_id", clientId ?? user.id).eq("position", position);
  return error ? { error: error.message } : { ok: true };
}
