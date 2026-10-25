import "server-only";
import type { DbFood } from "./food";

/**
 * USDA FoodData Central (whole foods) and Open Food Facts (packaged foods by barcode).
 * USDA needs a free key from api.data.gov (USDA_API_KEY); without one it uses the shared DEMO_KEY, which is rate-limited.
 */
const USDA = "https://api.nal.usda.gov/fdc/v1";
const key = () => process.env.USDA_API_KEY?.replace(/\s+/g, "") || "DEMO_KEY";
// Nutrient numbers in FoodData Central: energy (kcal), protein, fiber, potassium.
// Matched on nutrientNumber (e.g. "208") or nutrientId (e.g. 1008); Foundation foods carry energy as 957/958 (Atwater).
const ENERGY = ["208", "1008", "957", "958", "2047", "2048"], PROTEIN = ["203", "1003"], FIBER = ["291", "1079"], POTASSIUM = ["306", "1092"];

type UsdaNutrient = { nutrientNumber?: string; nutrientId?: number; value?: number; unitName?: string; nutrient?: { number?: string } };
type UsdaFood = {
  fdcId: number; description: string; brandOwner?: string; brandName?: string; dataType?: string;
  servingSize?: number; servingSizeUnit?: string; householdServingFullText?: string;
  foodNutrients?: UsdaNutrient[];
};

function pick(ns: UsdaNutrient[], nums: string[]) {
  for (const num of nums) {
    const n = ns.find((x) => (x.nutrientNumber ?? x.nutrient?.number) === num || String(x.nutrientId) === num);
    if (n?.value != null) return n.value;
  }
  return 0;
}
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s,(-])([a-z])/g, (_, a, b) => a + b.toUpperCase());

function fromUsda(f: UsdaFood): DbFood {
  const ns = f.foodNutrients ?? [];
  const grams = f.servingSizeUnit && /^(g|grm)$/i.test(f.servingSizeUnit) ? f.servingSize ?? null : null;
  return {
    id: `usda:${f.fdcId}`, source: "usda", name: titleCase(f.description), brand: f.brandName || f.brandOwner || null,
    // Branded foods in FDC are stored per 100 g as well.
    per100: { calories: pick(ns, ENERGY), protein_g: pick(ns, PROTEIN), fiber_g: pick(ns, FIBER), potassium_mg: pick(ns, POTASSIUM) },
    servingGrams: grams, servingLabel: f.householdServingFullText ?? null,
  };
}

export async function searchUsda(query: string, branded = false): Promise<DbFood[]> {
  const res = await fetch(`${USDA}/foods/search?api_key=${key()}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query, pageSize: 12,
      dataType: branded ? ["Branded"] : ["Foundation", "SR Legacy", "Survey (FNDDS)"],
    }),
    next: { revalidate: 86400 },
  });
  if (res.status === 429) throw new Error("The food database is busy (too many searches). Try again in a few minutes.");
  if (!res.ok) throw new Error(`Food database error ${res.status}`);
  const data = (await res.json()) as { foods?: UsdaFood[] };
  return (data.foods ?? []).map(fromUsda).filter((f) => f.per100.calories > 0 || f.per100.protein_g > 0);
}

type OffProduct = {
  product_name?: string; brands?: string; serving_size?: string; serving_quantity?: number | string;
  nutriments?: Record<string, number | string>;
};

export async function lookupBarcode(code: string): Promise<DbFood | null> {
  const clean = code.replace(/\D/g, "");
  if (!clean) return null;
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${clean}.json?fields=product_name,brands,serving_size,serving_quantity,nutriments`, {
    headers: { "user-agent": "DWTP-app/1.0 (michael@straightupfitness.com)" }, next: { revalidate: 86400 },
  });
  if (res.ok) {
    const data = (await res.json()) as { status?: number; product?: OffProduct };
    const p = data.product;
    if (data.status === 1 && p?.nutriments) {
      const n = p.nutriments;
      const num = (k: string) => Number(n[k] ?? 0) || 0;
      const kcal = num("energy-kcal_100g") || num("energy_100g") / 4.184;
      return {
        id: `off:${clean}`, source: "off", name: p.product_name?.trim() || "Packaged food", brand: p.brands?.split(",")[0]?.trim() || null,
        per100: { calories: Math.round(kcal), protein_g: num("proteins_100g"), fiber_g: num("fiber_100g"), potassium_mg: Math.round(num("potassium_100g") * 1000) },
        servingGrams: Number(p.serving_quantity) || null, servingLabel: p.serving_size ?? null,
      };
    }
  }
  // Not in Open Food Facts: try USDA's branded foods by barcode.
  const hits = await searchUsda(clean, true).catch(() => []);
  return hits[0] ?? null;
}
