import type { SupabaseClient } from "@supabase/supabase-js";
import type { FoodItem } from "@/lib/food";

/**
 * November 18 (Heather): "I have to re-enter everything all over again." Every food she logged in the last 4
 * months, once each (her most recent amount and numbers), most-eaten first, so she can add it again in one tap,
 * and so the AI can recognize her usual foods (her turkey sausage, not pork sausage).
 */
export async function loadMyFoods(supabase: SupabaseClient, clientId: string, limit = 80): Promise<(FoodItem & { times: number })[]> {
  const since = new Date(Date.now() - 120 * 86_400_000).toISOString();
  const { data } = await supabase.from("food_logs").select("items, eaten_at").eq("client_id", clientId).gte("eaten_at", since)
    .order("eaten_at", { ascending: false }).limit(500);
  const byName = new Map<string, FoodItem & { times: number }>();
  for (const row of data ?? []) {
    for (const it of (row.items as FoodItem[] | null) ?? []) {
      const key = (it.name ?? "").trim().toLowerCase();
      if (!key) continue;
      const had = byName.get(key);
      if (had) had.times++;
      else byName.set(key, { ...it, times: 1 });
    }
  }
  return [...byName.values()].sort((a, b) => b.times - a.times).slice(0, limit);
}

/** Her food rules, if any (tolerates the column not being there yet). */
export async function loadFoodRules(supabase: SupabaseClient, clientId: string): Promise<string | null> {
  const { data, error } = await supabase.from("profiles").select("food_rules").eq("id", clientId).maybeSingle();
  if (error) return null;
  return ((data?.food_rules as string | null) ?? "").trim() || null;
}
