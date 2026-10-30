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
  foodMeasures?: { disseminationText?: string; gramWeight?: number }[];
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
    portions: (f.foodMeasures ?? []).filter((m) => m.disseminationText && m.gramWeight && !/not specified/i.test(m.disseminationText))
      .map((m) => ({ label: m.disseminationText!.trim(), grams: m.gramWeight! })).slice(0, 8),
  };
}

export async function searchUsda(query: string, branded = false, pageSize = 12): Promise<DbFood[]> {
  const res = await fetch(`${USDA}/foods/search?api_key=${key()}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query, pageSize,
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
  code?: string; product_name?: string; brands?: string; serving_size?: string; serving_quantity?: number | string;
  nutriments?: Record<string, number | string>;
};

function fromOff(p: OffProduct, code: string): DbFood | null {
  if (!p.nutriments) return null;
  const n = p.nutriments;
  const num = (k: string) => Number(n[k] ?? 0) || 0;
  const kcal = num("energy-kcal_100g") || num("energy_100g") / 4.184;
  if (!kcal && !num("proteins_100g")) return null;
  const sg = Number(p.serving_quantity) || null;
  return {
    id: `off:${code}`, source: "off", name: p.product_name?.trim() || "Packaged food", brand: p.brands?.split(",")[0]?.trim() || null,
    per100: { calories: Math.round(kcal), protein_g: num("proteins_100g"), fiber_g: num("fiber_100g"), potassium_mg: Math.round(num("potassium_100g") * 1000) },
    servingGrams: sg, servingLabel: p.serving_size ?? null,
  };
}

/** Open Food Facts by name or brand (October 30: brands typed in, like a protein powder, weren't found). */
export async function searchOff(query: string): Promise<DbFood[]> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
  try {
    const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&json=1&page_size=12&fields=code,product_name,brands,serving_size,serving_quantity,nutriments`, {
      headers: { "user-agent": "DWTP-app/1.0 (michael@straightupfitness.com)" }, signal: ctl.signal, next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { products?: OffProduct[] };
    return (data.products ?? []).map((p) => fromOff(p, p.code ?? "")).filter((x): x is DbFood => !!x && !!x.name);
  } catch { return []; } finally { clearTimeout(t); }
}

/**
 * One search box for everything: whole foods (USDA), US brands (USDA branded) and packaged foods worldwide
 * (Open Food Facts). When she types a brand, the brand results come first.
 */
export async function searchFoods(query: string): Promise<DbFood[]> {
  const [generic, branded, off] = await Promise.all([
    searchUsda(query, false, 10).catch(() => [] as DbFood[]),
    searchUsda(query, true, 10).catch(() => [] as DbFood[]),
    searchOff(query),
  ]);
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
  const brandHit = (f: DbFood) => !!f.brand && words.some((w) => f.brand!.toLowerCase().includes(w));
  const brandFirst = [...branded, ...off].some(brandHit);
  const brands = [...off.filter(brandHit), ...branded.filter(brandHit), ...off.filter((f) => !brandHit(f)), ...branded.filter((f) => !brandHit(f))];
  const all = brandFirst ? [...brands, ...generic] : [...generic, ...brands];
  const seen = new Set<string>();
  return all.filter((f) => { const k = `${f.name}|${f.brand ?? ""}`.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 30);
}

export async function lookupBarcode(code: string): Promise<DbFood | null> {
  const clean = code.replace(/\D/g, "");
  if (!clean) return null;
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${clean}.json?fields=product_name,brands,serving_size,serving_quantity,nutriments`, {
    headers: { "user-agent": "DWTP-app/1.0 (michael@straightupfitness.com)" }, next: { revalidate: 86400 },
  });
  if (res.ok) {
    const data = (await res.json()) as { status?: number; product?: OffProduct };
    const f = data.status === 1 && data.product ? fromOff(data.product, clean) : null;
    if (f) return f;
  }
  // Not in Open Food Facts: try USDA's branded foods by barcode.
  const hits = await searchUsda(clean, true).catch(() => []);
  return hits[0] ?? null;
}
