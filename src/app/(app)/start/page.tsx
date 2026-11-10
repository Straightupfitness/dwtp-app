import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadVideos } from "@/lib/videos";
import OnboardingFlow from "./OnboardingFlow";

/** Onboarding at /start (November 10; /welcome is the invite link): welcome video, three unlock questions, then the Driven Woman Blueprint. */
export default async function WelcomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: p }, { data: as }, onb, sevenX] = await Promise.all([
    supabase.from("profiles").select("full_name, role").eq("id", user.id).single(),
    supabase.from("assessments").select("answers, submitted_at").eq("client_id", user.id).maybeSingle(),
    loadVideos(supabase, "ONB"), loadVideos(supabase, "7X"),
  ]);
  if (p?.role === "coach") redirect("/coach/blueprint-preview");
  if (as?.submitted_at) redirect("/today");
  const videos = Object.fromEntries([...onb.values(), ...sevenX.values()].map((v) => [v.code, v.url]));
  return (
    <section className="mx-auto max-w-md">
      <OnboardingFlow first={((p?.full_name as string | null) ?? "").split(/\s+/)[0] || "there"} userId={user.id} videos={videos}
        saved={(as?.answers as Record<string, unknown> | null) ?? {}} />
    </section>
  );
}
