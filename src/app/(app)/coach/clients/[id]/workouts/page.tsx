import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import WorkoutHistory from "@/components/WorkoutHistory";

/** Michael sees a client's workout history: Trainerize and this app, every set. */
export default async function ClientWorkouts({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase.from("profiles").select("full_name").eq("id", id).single();
  return (
    <section className="space-y-4">
      <Link href={`/coach/clients/${id}`} className="inline-flex min-h-11 items-center text-sm text-dim">← {p?.full_name ?? "Client"}</Link>
      <header>
        <p className="text-xs uppercase tracking-[0.15em] text-accent">{p?.full_name}</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl uppercase">Workout history</h1>
      </header>
      <WorkoutHistory supabase={supabase} clientId={id} />
    </section>
  );
}
