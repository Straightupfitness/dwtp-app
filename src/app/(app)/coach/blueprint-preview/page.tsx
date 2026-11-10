import { createClient } from "@/lib/supabase/server";
import { loadVideos } from "@/lib/videos";
import OnboardingFlow from "@/app/(app)/start/OnboardingFlow";

/** November 10: Michael walks through onboarding and the Driven Woman Blueprint as a new client sees it. Nothing is saved. */
export default async function BlueprintPreview() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [onb, sevenX] = await Promise.all([loadVideos(supabase, "ONB"), loadVideos(supabase, "7X")]);
  return (
    <section className="mx-auto max-w-md space-y-3">
      <p className="text-xs uppercase tracking-[0.15em] text-accent">Coach · preview · nothing is saved</p>
      <OnboardingFlow preview first="Linda" userId={user!.id} saved={{}}
        videos={Object.fromEntries([...onb.values(), ...sevenX.values()].map((v) => [v.code, v.url]))} />
    </section>
  );
}
