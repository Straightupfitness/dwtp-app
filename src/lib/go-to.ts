import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * November 26 (Michael): her 3 go-to meals (and up to 3 backups), the meals she eats every day and perfects over time.
 * Each ingredient has how much goes in the meal, the brand and store, and the package she buys (size in the same unit,
 * and price), so the app can work out a shopping list and what the meals cost per week or month.
 */
export type GoItem = {
  name: string; qty: number | null; unit: string; brand: string; store: string;
  pkg_qty: number | null; pkg_price: number | null;
  kcal?: number | null; protein?: number | null; fiber?: number | null;
};
export type GoMeal = { position: number; name: string; items: GoItem[]; currency: string };

export const DAYS = { week: 7, month: 30 } as const;
export type Period = keyof typeof DAYS;

/** What one serving of this ingredient costs (null until the amount, package size and price are all filled in). */
export const itemCost = (i: GoItem) => (i.qty && i.pkg_qty && i.pkg_price != null ? (i.qty / i.pkg_qty) * i.pkg_price : null);
export const mealCost = (m: GoMeal) => m.items.reduce((s, i) => s + (itemCost(i) ?? 0), 0);
export const mealMissing = (m: GoMeal) => m.items.filter((i) => i.name.trim() && itemCost(i) === null).length;
export const macros = (m: GoMeal) => m.items.reduce((t, i) => ({ kcal: t.kcal + (Number(i.kcal) || 0), protein: t.protein + (Number(i.protein) || 0), fiber: t.fiber + (Number(i.fiber) || 0) }), { kcal: 0, protein: 0, fiber: 0 });

/** The shopping list for her main meals (eaten every day) over a week or a month, grouped by store. */
export function shoppingList(meals: GoMeal[], period: Period) {
  const days = DAYS[period];
  const map = new Map<string, { name: string; brand: string; store: string; unit: string; need: number; pkg_qty: number | null; pkg_price: number | null }>();
  for (const m of meals) for (const i of m.items) {
    if (!i.name.trim() || !i.qty) continue;
    const key = `${i.name.trim().toLowerCase()}|${i.brand.trim().toLowerCase()}|${i.store.trim().toLowerCase()}|${i.unit.trim().toLowerCase()}`;
    const x = map.get(key) ?? { name: i.name.trim(), brand: i.brand.trim(), store: i.store.trim(), unit: i.unit.trim(), need: 0, pkg_qty: i.pkg_qty, pkg_price: i.pkg_price };
    x.need += i.qty * days;
    map.set(key, x);
  }
  const rows = [...map.values()].map((x) => {
    const packs = x.pkg_qty ? Math.ceil(x.need / x.pkg_qty - 1e-9) : null;
    return { ...x, packs, spend: packs !== null && x.pkg_price != null ? packs * x.pkg_price : null };
  });
  const stores = new Map<string, typeof rows>();
  for (const r of rows.sort((a, b) => a.name.localeCompare(b.name))) { const s = r.store || "Any store"; stores.set(s, [...(stores.get(s) ?? []), r]); }
  return [...stores.entries()].sort((a, b) => (a[0] === "Any store" ? 1 : b[0] === "Any store" ? -1 : a[0].localeCompare(b[0])));
}

export const money = (n: number, cur: string) => `${cur}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** $ in the US, € in most of Europe, £ in the UK (she can change it). */
export const currencyFor = (tz: string | null | undefined) => (tz === "Europe/London" ? "£" : tz?.startsWith("Europe/") ? "€" : "$");

export async function loadGoTo(supabase: SupabaseClient, clientId: string): Promise<{ meals: GoMeal[]; ready: boolean }> {
  const { data, error } = await supabase.from("go_to_meals").select("position, name, items, currency").eq("client_id", clientId).order("position");
  if (error) return { meals: [], ready: false };
  return { ready: true, meals: (data ?? []).map((m) => ({ position: m.position as number, name: (m.name as string) ?? "", items: ((m.items as GoItem[]) ?? []), currency: (m.currency as string) || "$" })) };
}
