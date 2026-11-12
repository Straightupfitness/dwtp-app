import { createClient } from "@/lib/supabase/server";
import { progressFor } from "@/lib/badges-server";
import ProgressView, { BadgesCard } from "@/components/ProgressView";
import CirclesSection from "@/components/CirclesSection";
import { loadProgram } from "@/lib/circles";
import BackButton from "@/components/BackButton";
import ProgressPhotos from "@/components/ProgressPhotos";
import { loadProgressPhotos } from "@/lib/progress-photos";
import { todayIn } from "@/lib/program";

const display = "font-[family-name:var(--font-display)] uppercase";

/** Her Progress tab (October 29): her circles, badges, goals, weight, food, water and steps in one place. */
export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const r = Number((await searchParams).r);
  const range = [14, 30, 90].includes(r) ? r : 30;
  const [{ data, status }, state, photos, { data: me }] = await Promise.all([
    progressFor(supabase, user!.id), loadProgram(supabase, user!.id), loadProgressPhotos(supabase, user!.id),
    supabase.from("profiles").select("timezone").eq("id", user!.id).single(),
  ]);
  return (
    <section className="space-y-4">
      <BackButton fallback="/today" />
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Look how far you&apos;ve come</p>
        <h1 className={`${display} mt-1 text-[30px] font-semibold`}>Your progress</h1>
      </header>
      <CirclesSection state={state} />
      <ProgressPhotos photos={photos} userId={user!.id} today={todayIn(me?.timezone ?? "America/Los_Angeles")} />
      <BadgesCard badges={status} />
      <ProgressView data={data} badges={status} range={range} base="/progress" hideBadges />
    </section>
  );
}
