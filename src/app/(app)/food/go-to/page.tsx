import { createClient } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import { currencyFor, loadGoTo } from "@/lib/go-to";
import GoToPlanner from "./GoToPlanner";

const display = "font-[family-name:var(--font-display)] uppercase";

/**
 * November 26 (Michael): her 3 go-to meals and "How much will this cost?". Food → My 3 go-to meals.
 */
export default async function GoToPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ meals, ready }, { data: p }, { data: saved }] = await Promise.all([
    loadGoTo(supabase, user!.id),
    supabase.from("profiles").select("timezone").eq("id", user!.id).maybeSingle(),
    supabase.from("saved_meals").select("id, name, items").eq("client_id", user!.id).order("last_used_at", { ascending: false, nullsFirst: false }).limit(60),
  ]);
  const tz = (p?.timezone as string | null) ?? "America/Los_Angeles";
  return (
    <section className="space-y-4">
      <BackButton fallback="/food" />
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">The meals you eat every day</p>
        <h1 className={`${display} mt-1 text-[30px] font-semibold`}>My 3 go-to meals</h1>
        <p className="mt-1 text-[14px] text-[#a8a8a8]">Three meals you love, each with 40 g+ protein and 10 g+ fiber, that you eat every day and get better at over time. Add the ingredients, the brand and where you buy them, and you&apos;ll get your shopping list and what it all costs.</p>
      </header>
      {ready
        ? <GoToPlanner initial={meals} defaultCurrency={currencyFor(tz)} tz={tz}
            saved={(saved ?? []).map((s) => ({ id: s.id as string, name: (s.name as string) ?? "Saved meal", items: ((s.items as { name: string; amount: string }[]) ?? []).map((i) => ({ name: i.name, amount: i.amount })) }))} />
        : <p className="rounded-2xl border border-dashed border-[#2f2f2f] p-6 text-center text-dim">This is almost ready. Check back soon.</p>}
    </section>
  );
}
