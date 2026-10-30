export type FoodItem = {
  name: string;
  amount: string;
  calories: number;
  protein_g: number;
  fiber_g: number;
  potassium_mg: number;
};

export type FoodEstimate = { items: FoodItem[]; notes?: string };

export const DAILY_TARGETS = { protein_g: 120, fiber_g: 30, potassium_mg: 4700 };

export function totals(items: FoodItem[]) {
  return items.reduce(
    (t, i) => ({
      calories: t.calories + (Number(i.calories) || 0),
      protein_g: t.protein_g + (Number(i.protein_g) || 0),
      fiber_g: t.fiber_g + (Number(i.fiber_g) || 0),
      potassium_mg: t.potassium_mg + (Number(i.potassium_mg) || 0),
    }),
    { calories: 0, protein_g: 0, fiber_g: 0, potassium_mg: 0 },
  );
}

/** A food from a database, per 100 g, plus its usual serving if known. */
export type DbFood = {
  id: string; name: string; brand?: string | null; source: "usda" | "off";
  per100: { calories: number; protein_g: number; fiber_g: number; potassium_mg: number };
  servingGrams?: number | null; servingLabel?: string | null;
  /** Household portions with their weight: [{label: "1 egg", grams: 50}, {label: "1 cup", grams: 245}]. */
  portions?: { label: string; grams: number }[];
};

const r1 = (n: number) => Math.round(n * 10) / 10;
/** Turn a database food plus an amount in grams into a log item. */
export function scaleFood(f: DbFood, grams: number, label?: string): FoodItem {
  const k = grams / 100;
  return {
    name: f.brand ? `${f.name} (${f.brand})` : f.name,
    amount: label ?? `${Math.round(grams)} g`,
    calories: Math.round(f.per100.calories * k),
    protein_g: r1(f.per100.protein_g * k),
    fiber_g: r1(f.per100.fiber_g * k),
    potassium_mg: Math.round(f.per100.potassium_mg * k),
  };
}

/** "6 oz" → 6 and "oz"; "1 1/2 cups" → 1.5 and "cups"; "1/2 avocado" → 0.5 and "avocado". */
export function parseQty(s: string): { n: number; unit: string; rest: string } | null {
  const m = s.match(/^\s*(?:(\d+(?:\.\d+)?)\s+)?(?:(\d+)\/(\d+)|(\d+(?:\.\d+)?))/);
  if (!m) return null;
  const n = (m[1] ? Number(m[1]) : 0) + (m[2] ? Number(m[2]) / Number(m[3]) : Number(m[4] ?? 0));
  return n > 0 ? { n, unit: s.slice(m[0].length).trim().toLowerCase(), rest: s.slice(m[0].length).trim() } : null;
}
