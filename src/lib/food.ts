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
