import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/program";
import { addDays } from "@/lib/daily";
import type { FoodItem } from "@/lib/food";
import FeedbackList, { type FeedbackRow } from "./FeedbackList";

const SLOT: Record<string, string> = { meal_1: "Meal 1", meal_2: "Meal 2", meal_3: "Meal 3", other: "Other" };
const long = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

/**
 * Daily food feedback (November 7): every client who logged food on a day, with an AI-drafted text in Michael's
 * voice (what she did well, one fix, a push for tomorrow). He edits it, then texts it or sends it in the app.
 */
export default async function FoodFeedbackPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const supabase = await createClient();
  const today = todayIn("America/Los_Angeles");
  const sp = await searchParams;
  const day = sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) && sp.d <= today ? sp.d : addDays(today, -1);

  const { data: clients } = await supabase.from("profiles").select("id, full_name, phone, timezone, status").eq("role", "client").order("full_name");
  const list = (clients ?? []).filter((c) => c.status !== "cancelled");
  const ids = list.map((c) => c.id);

  const logs: { client_id: string; eaten_at: string; meal_slot: string | null; description: string | null; items: FoodItem[] | null; calories: number | null; protein_g: number | null; fiber_g: number | null }[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data } = await supabase.from("food_logs").select("client_id, eaten_at, meal_slot, description, items, calories, protein_g, fiber_g")
      .in("client_id", ids).gte("eaten_at", addDays(day, -1) + "T00:00:00Z").lt("eaten_at", addDays(day, 2) + "T00:00:00Z").order("eaten_at").range(from, from + 999);
    logs.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  const [{ data: targets }, fb] = await Promise.all([
    supabase.from("nutrition_targets").select("client_id, calorie_target, protein_g").in("client_id", ids),
    supabase.from("food_feedback").select("client_id, draft, sent_text, sent_via").eq("day", day),
  ]);
  const needsSql = !!fb.error;
  const tgt = new Map((targets ?? []).map((t) => [t.client_id as string, t]));
  const saved = new Map((fb.data ?? []).map((f) => [f.client_id as string, f]));

  const rows: FeedbackRow[] = [];
  const none: { id: string; name: string }[] = [];
  for (const c of list) {
    const tz = c.timezone ?? "America/Los_Angeles";
    const meals = logs.filter((l) => l.client_id === c.id && todayIn(tz, new Date(l.eaten_at)) === day);
    if (!meals.length) { none.push({ id: c.id, name: c.full_name ?? "(no name)" }); continue; }
    const f = saved.get(c.id);
    const t = tgt.get(c.id);
    rows.push({
      id: c.id, name: c.full_name ?? "(no name)", phone: c.phone ?? null,
      kcal: Math.round(meals.reduce((a, m) => a + (m.calories ?? 0), 0)), protein: Math.round(meals.reduce((a, m) => a + (m.protein_g ?? 0), 0)),
      kcalTarget: t?.calorie_target ?? null, proteinTarget: t?.protein_g ?? 120,
      meals: meals.map((m) => ({
        slot: SLOT[m.meal_slot ?? ""] ?? "Meal", kcal: Math.round(m.calories ?? 0), protein: Math.round(m.protein_g ?? 0),
        foods: (m.items ?? []).map((i) => i.name).join(", ") || m.description || "",
      })),
      draft: f?.draft ?? null, sentText: f?.sent_text ?? null, sentVia: (f?.sent_via as FeedbackRow["sentVia"]) ?? null,
    });
  }

  const arrow = "grid size-11 place-items-center rounded-full border border-border text-xl";
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.15em] text-accent">Coach</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl uppercase">Food feedback</h1>
        <p className="text-sm text-dim">A short text for each client about her food: one win, one fix, one push for tomorrow. Edit it, then text it or send it in the app.</p>
      </header>
      <div className="flex items-center gap-2">
        <Link href={`/coach/food?d=${addDays(day, -1)}`} aria-label="Day before" className={arrow}>‹</Link>
        <p className="flex-1 text-center font-semibold">{day === today ? "Today" : day === addDays(today, -1) ? "Yesterday" : ""} <span className="text-dim">{long(day)}</span></p>
        {day < today ? <Link href={`/coach/food?d=${addDays(day, 1)}`} aria-label="Next day" className={arrow}>›</Link> : <span className="size-11" />}
      </div>
      {needsSql && <p className="rounded-xl border border-[#3a3020] bg-[#161310] p-3 text-sm text-[#d9c9a8]">Run <b>SQL 15 (food feedback)</b> in Supabase so drafts and what you&apos;ve sent are saved. Drafting still works without it.</p>}
      <FeedbackList key={day} day={day} rows={rows} />
      {none.length > 0 && (
        <details className="rounded-2xl border border-border bg-card p-3.5">
          <summary className="cursor-pointer text-sm"><b>{none.length}</b> <span className="text-dim">logged nothing this day</span></summary>
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">{none.map((n) => <Link key={n.id} href={`/coach/clients/${n.id}`} className="text-accent">{n.name}</Link>)}</p>
        </details>
      )}
    </section>
  );
}
