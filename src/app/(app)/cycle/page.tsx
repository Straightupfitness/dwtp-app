import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/program";
import { loadCycle } from "@/lib/cycle";
import BackButton from "@/components/BackButton";
import CycleSettings from "./CycleSettings";

/** November 17 (Michael): the cycle tracker's settings and her period history. */
export default async function CyclePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: p } = await supabase.from("profiles").select("timezone").eq("id", user!.id).single();
  const today = todayIn(p?.timezone ?? "America/Los_Angeles");
  const c = await loadCycle(supabase, user!.id, today);
  return (
    <section className="space-y-4">
      <BackButton fallback="/today" />
      <header>
        <p className="text-xs uppercase tracking-[0.15em] text-accent">Optional</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl uppercase">Cycle tracker</h1>
        <p className="mt-1 text-[14px] text-dim">Your energy and strength can change through your cycle. Track it here, and each workout suggests going heavy, normal or lighter. You always decide.</p>
      </header>
      {c ? <CycleSettings mode={c.mode} periods={c.periods} today={today} /> : <p className="text-dim">The cycle tracker isn&apos;t switched on yet.</p>}
    </section>
  );
}
