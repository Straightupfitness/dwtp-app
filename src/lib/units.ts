import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * November 26 (Michael): a client can log her weight in kilograms (his client in the Netherlands). Weights are always
 * stored in pounds; her screens show them in her unit. Michael's screens stay in pounds.
 */
export type WeightUnit = "lbs" | "kg";
const LB = 0.45359237;
const r1 = (n: number) => Math.round(n * 10) / 10;
/** Pounds → her unit (one decimal). */
export const toUnit = (lbs: number, u: WeightUnit) => r1(u === "kg" ? lbs * LB : lbs);
/** Her unit → pounds (one decimal), for saving. */
export const toLbs = (v: number, u: WeightUnit) => r1(u === "kg" ? v / LB : v);
/** A believable weight in her unit (60–600 lbs). */
export const okWeight = (v: number, u: WeightUnit) => { const lbs = u === "kg" ? v / LB : v; return lbs >= 60 && lbs <= 600; };
export const asUnit = (v: unknown): WeightUnit => (v === "kg" ? "kg" : "lbs");

/** Her unit (before SQL 41, always pounds). */
export async function loadWeightUnit(supabase: SupabaseClient, id: string): Promise<WeightUnit> {
  const { data, error } = await supabase.from("profiles").select("weight_unit").eq("id", id).maybeSingle();
  return error ? "lbs" : asUnit(data?.weight_unit);
}
