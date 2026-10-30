import { createClient } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import WorkoutHistory from "@/components/WorkoutHistory";

/** Every workout she's done, here and in Trainerize, with every set. */
export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <section className="space-y-4">
      <BackButton fallback="/workouts" />
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Every rep counts</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[30px] font-semibold uppercase">Workout history</h1>
      </header>
      <WorkoutHistory supabase={supabase} clientId={user!.id} />
    </section>
  );
}
