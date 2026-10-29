import { createClient } from "@/lib/supabase/server";
import { progressFor } from "@/lib/badges-server";
import ProgressView from "@/components/ProgressView";
import BackButton from "@/components/BackButton";

const display = "font-[family-name:var(--font-display)] uppercase";

/** Her Progress tab (October 29): goals, weight, food, water, steps and badges in one place. */
export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const r = Number((await searchParams).r);
  const range = [14, 30, 90].includes(r) ? r : 30;
  const { data, status } = await progressFor(supabase, user!.id);
  return (
    <section className="space-y-4">
      <BackButton fallback="/today" />
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Look how far you&apos;ve come</p>
        <h1 className={`${display} mt-1 text-[30px] font-semibold`}>Your progress</h1>
      </header>
      <ProgressView data={data} badges={status} range={range} base="/progress" />
    </section>
  );
}
