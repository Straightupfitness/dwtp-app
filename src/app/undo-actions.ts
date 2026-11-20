"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * November 20 (Michael): undo and redo anywhere in the app (SQL 35). The database remembers each person's last steps;
 * these put the last one back, or do it again.
 */
const WORDS: Record<string, string> = {
  food_logs: "meal", saved_meals: "favorite meal", recipe_favorites: "saved recipe", weight_logs: "weight", water_days: "water",
  habit_logs: "habit", cp_ledger: "", client_items: "habit", client_rings: "medal", client_focus_circles: "focus circle",
  set_logs: "workout set", workout_sessions: "workout", cycle_days: "cycle day", cycle_periods: "period", lesson_progress: "lesson",
  likes: "like", comment_likes: "like", bad_weeks: "bad week", nutrition_targets: "targets", coach_followups: "follow-up",
  leads: "lead", kpi_expenses: "expense", kpi_slots: "time slot", kpi_clients: "client", kpi_payments: "payment",
};
const say = (tables: string[]) => [...new Set(tables.map((t) => WORDS[t] ?? t.replace(/_/g, " ")).filter(Boolean))].slice(0, 3).join(", ");

async function run(fn: "undo_last" | "redo_last") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { data, error } = await supabase.rpc(fn);
  if (error) return { ok: false, error: /does not exist|schema cache/i.test(error.message) ? "Run the 35 undo SQL file in Supabase first." : error.message };
  const r = (data ?? {}) as { ok?: boolean; tables?: string[] };
  if (!r.ok) return { ok: false, error: fn === "undo_last" ? "Nothing to undo." : "Nothing to redo." };
  revalidatePath("/", "layout");
  return { ok: true, what: say(r.tables ?? []) };
}
export async function undoLast() { return run("undo_last"); }
export async function redoLast() { return run("redo_last"); }

/** Her latest step that can be undone (0 if none). */
export async function undoPeek() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("undo_peek");
  return error ? 0 : Number(data ?? 0);
}
