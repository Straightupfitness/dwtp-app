"use server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { todayIn } from "@/lib/program";

/** One client's Trainerize history, sent in pieces (server actions take about 1 MB at a time). */
export type HistoryPart = {
  email: string; tzId: number;
  weights?: [string, number][]; weightGoal?: number | null; steps?: [string, number][];
  days?: { date: string; kcal: number; protein: number; fiber: number | null; potassium: number | null;
    meals: { name: string; time: string; desc: string; foods: [string, number | null, string, number, number][] }[] }[];
  favorites?: { name: string; foods: [string, number | null, string, number, number][]; fiber: number; potassium: number }[];
};

const SLOT: Record<string, string> = { breakfast: "meal_1", lunch: "meal_2", dinner: "meal_3" };

/** "2026-10-27 09:04:32" in her time zone → an exact moment. */
function localToIso(local: string, tz: string) {
  const asUtc = new Date(local.replace(" ", "T") + "Z");
  if (isNaN(asUtc.getTime())) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(asUtc).map((p) => [p.type, p.value]));
  const shown = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return new Date(asUtc.getTime() - (shown - asUtc.getTime())).toISOString();
}

/**
 * Import part of one client's Trainerize history (October 29). Never overwrites what she logged in the new app:
 * existing weigh-ins and step days stay, and a day she already logged food on here is skipped.
 */
export async function importHistory(part: HistoryPart) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").single();
  if (me?.role !== "coach") return { error: "Coach only" };
  const db = adminClient();
  const { data: p } = await db.from("profiles").select("id, timezone, start_weight_lbs, goal_weight_lbs").ilike("email", part.email.trim()).maybeSingle();
  if (!p) return { skipped: `${part.email} isn't in the app` };
  const tz = p.timezone ?? "America/Los_Angeles";
  const out = { weights: 0, steps: 0, meals: 0, daysSkipped: 0, favorites: 0 };

  if (part.weights?.length) {
    const rows = part.weights.filter(([, v]) => v >= 60 && v <= 600).map(([d, v]) => ({ client_id: p.id, log_date: d, weight_lbs: Math.round(v * 10) / 10 }));
    const { error } = await db.from("weight_logs").upsert(rows, { onConflict: "client_id,log_date", ignoreDuplicates: true });
    if (error) return { error: error.message };
    out.weights = rows.length;
    const patch: Record<string, number> = {};
    if (p.start_weight_lbs == null && rows.length) patch.start_weight_lbs = rows[0].weight_lbs;
    if (p.goal_weight_lbs == null && part.weightGoal && part.weightGoal >= 60) patch.goal_weight_lbs = part.weightGoal;
    if (Object.keys(patch).length) await db.from("profiles").update(patch).eq("id", p.id);
  }
  if (part.steps?.length) {
    const rows = part.steps.filter(([, s]) => s > 0 && s < 150_000).map(([d, s]) => ({ client_id: p.id, day: d, steps: Math.round(s), source: "trainerize" }));
    const { error } = await db.from("health_days").upsert(rows, { onConflict: "client_id,day", ignoreDuplicates: true });
    if (error) return { error: error.message };
    out.steps = rows.length;
  }
  if (part.days?.length) {
    const dates = part.days.map((d) => d.date).sort();
    const from = new Date(Date.parse(dates[0]) - 86_400_000).toISOString(), to = new Date(Date.parse(dates[dates.length - 1]) + 2 * 86_400_000).toISOString();
    const { data: had } = await db.from("food_logs").select("eaten_at, import_key").eq("client_id", p.id).gte("eaten_at", from).lt("eaten_at", to);
    const loggedHere = new Set((had ?? []).filter((r) => !r.import_key).map((r) => todayIn(tz, new Date(r.eaten_at))));
    const rows: Record<string, unknown>[] = [];
    for (const d of part.days) {
      if (loggedHere.has(d.date)) { out.daysSkipped++; continue; }
      d.meals.forEach((m, i) => {
        const kcal = m.foods.reduce((s, f) => s + (f[3] || 0), 0);
        const share = d.kcal ? kcal / d.kcal : 0;   // her day's fiber and potassium, split by each meal's calories
        const fiber = (d.fiber ?? 0) * share, potassium = (d.potassium ?? 0) * share;
        const items = m.foods.map(([name, amount, unit, cal, prot]) => {
          const k = kcal ? (cal || 0) / kcal : 0;
          return { name, amount: `${amount ?? ""} ${unit}`.trim(), calories: Math.round(cal || 0), protein_g: Math.round((prot || 0) * 10) / 10,
            fiber_g: Math.round(fiber * k * 10) / 10, potassium_mg: Math.round(potassium * k) };
        });
        const at = localToIso(m.time || `${d.date} 12:00:00`, tz) ?? `${d.date}T19:00:00Z`;
        rows.push({
          client_id: p.id, eaten_at: todayIn(tz, new Date(at)) === d.date ? at : localToIso(`${d.date} 12:00:00`, tz), meal_slot: SLOT[m.name] ?? "other", source: "text",
          description: m.desc || "From Trainerize", photo_path: null, items, calories: Math.round(kcal),
          protein_g: Math.round(items.reduce((s, x) => s + x.protein_g, 0) * 10) / 10, fiber_g: Math.round(fiber * 10) / 10, potassium_mg: Math.round(potassium),
          confirmed: true, import_key: `tz:${part.tzId}:${d.date}:${i}:${m.name}`,
        });
      });
    }
    for (let i = 0; i < rows.length; i += 300) {
      const { error } = await db.from("food_logs").upsert(rows.slice(i, i + 300), { onConflict: "import_key", ignoreDuplicates: true });
      if (error) return { error: error.message };
    }
    out.meals = rows.length;
  }
  if (part.favorites?.length) {
    const { data: have } = await db.from("saved_meals").select("name").eq("client_id", p.id);
    const names = new Set((have ?? []).map((x) => String(x.name).toLowerCase()));
    const rows = part.favorites.filter((f) => !names.has(f.name.toLowerCase())).map((f) => {
      const kcal = f.foods.reduce((s, x) => s + (x[3] || 0), 0);
      const items = f.foods.map(([name, amount, unit, cal, prot]) => ({ name, amount: `${amount ?? ""} ${unit}`.trim(), calories: Math.round(cal || 0), protein_g: Math.round((prot || 0) * 10) / 10,
        fiber_g: kcal ? Math.round(f.fiber * (cal || 0) / kcal * 10) / 10 : 0, potassium_mg: kcal ? Math.round(f.potassium * (cal || 0) / kcal) : 0 }));
      return { client_id: p.id, name: f.name.slice(0, 60), kind: "favorite", items, calories: Math.round(kcal),
        protein_g: Math.round(items.reduce((s, x) => s + x.protein_g, 0) * 10) / 10, fiber_g: Math.round(f.fiber * 10) / 10, potassium_mg: Math.round(f.potassium), last_used_at: new Date().toISOString() };
    });
    if (rows.length) { const { error } = await db.from("saved_meals").insert(rows); if (error) return { error: error.message }; }
    out.favorites = rows.length;
  }
  return { ok: true, ...out };
}
