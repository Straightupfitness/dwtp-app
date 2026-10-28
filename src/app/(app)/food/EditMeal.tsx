"use client";
import type { FoodItem } from "@/lib/food";

export type MealToEdit = { id: string; items: FoodItem[]; slot: "meal_1" | "meal_2" | "meal_3" | "other"; eatenAt: string; photoUrl: string | null };
export const EDIT_EVENT = "dwtp:edit-meal";

/** Opens a saved meal in the meal checker (MealLogger listens for this), so she can fix the foods, the meal or the time. */
export default function EditMeal({ meal }: { meal: MealToEdit }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent(EDIT_EVENT, { detail: meal }))}
      className="min-h-9 px-1 text-xs font-semibold text-accent">Edit</button>
  );
}
