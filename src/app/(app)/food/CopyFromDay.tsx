"use client";
import { useEffect, useState, useTransition } from "react";
import { mealsOn } from "./actions";
import { CopyMeal } from "./MealButtons";

const SLOT: Record<string, string> = { meal_1: "Meal 1", meal_2: "Meal 2", meal_3: "Meal 3", other: "Other" };
const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
const label = (d: string, today: string) => d === addDays(today, -1) ? "Yesterday"
  : new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
type M = Awaited<ReturnType<typeof mealsOn>>[number];

/**
 * November 11 (Imelda: "I can only copy meals from yesterday"): pick any day (last week's quick picks, or any date)
 * and add any meal from it to the day she's logging, in one tap.
 */
export default function CopyFromDay({ toDay, today }: { toDay: string; today: string }) {
  const [from, setFrom] = useState(addDays(toDay, -1));
  const [meals, setMeals] = useState<M[] | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => { start(async () => setMeals(await mealsOn(from))); }, [from]);
  const quick = Array.from({ length: 7 }, (_, i) => addDays(toDay, -(i + 1)));
  const label2 = toDay === today ? "today" : label(toDay, today);
  return (
    <div className="space-y-2">
      <p className="pt-1 text-[11px] uppercase tracking-[0.15em] text-accent">Copy a meal from another day</p>
      <div className="flex items-center gap-2">
        <select value={quick.includes(from) ? from : "pick"} onChange={(e) => e.target.value !== "pick" && setFrom(e.target.value)} aria-label="Copy from which day"
          className="min-h-11 flex-1 rounded-xl border border-[#2a2a2a] bg-card px-3 text-[15px] outline-none focus:border-accent">
          {quick.map((d) => <option key={d} value={d}>{label(d, today)}</option>)}
          {!quick.includes(from) && <option value="pick">{label(from, today)}</option>}
        </select>
        <input type="date" max={today} value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} aria-label="Or pick any date"
          className="min-h-11 w-[10rem] rounded-xl border border-[#2a2a2a] bg-card px-2 text-[15px] outline-none [color-scheme:dark] focus:border-accent" />
      </div>
      <div className="divide-y divide-border rounded-2xl border border-border bg-card">
        {pending && !meals && <p className="px-3.5 py-3 text-[13px] text-dim">Loading…</p>}
        {meals && !meals.length && <p className="px-3.5 py-3 text-[13px] text-dim">Nothing logged that day. Pick another day.</p>}
        {meals?.map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-3.5 py-2">
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] uppercase tracking-[0.12em] text-dim">{SLOT[m.slot] ?? "Other"} · {m.calories} kcal · {m.protein} g protein</span>
              <span className="block truncate text-[14px]">{m.foods}</span>
            </span>
            <CopyMeal key={`${m.id}-${toDay}`} id={m.id} toDay={toDay} label={`+ Add to ${label2}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
