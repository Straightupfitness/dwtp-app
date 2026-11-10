import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { screensFor } from "@/lib/checkin-screens";
import { loadVideos } from "@/lib/videos";
import CheckinFlow from "@/app/(app)/checkin/CheckinFlow";

const WEEKS = [1, 2, 4, 8, 12, 13, 24, 26, 36, 52];

/** November 10: Michael walks through any week's check-in exactly as she sees it. Nothing is saved. */
export default async function CheckinPreview({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const { w } = await searchParams;
  const week = Math.min(52, Math.max(1, Number(w) || 1));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [videos, { data: circles }] = await Promise.all([
    loadVideos(supabase, "CHK"),
    supabase.from("circles").select("name, kind, sort").eq("kind", "growth").order("sort"),
  ]);
  return (
    <section className="mx-auto max-w-md space-y-4">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.15em] text-accent">Coach · preview</p>
        <p className="text-sm text-dim">Her check-in, exactly as she sees it. Nothing is saved. Pick a week:</p>
        <div className="flex flex-wrap gap-1.5">
          {WEEKS.map((n) => <Link key={n} href={`/coach/checkin-preview?w=${n}`} className={`grid min-h-9 min-w-9 place-items-center rounded-lg px-2 text-sm ${n === week ? "bg-accent font-semibold text-black" : "border border-border"}`}>{n}</Link>)}
        </div>
      </header>
      <CheckinFlow key={week} preview week={week} userId={user!.id} screens={screensFor(week)}
        videos={Object.fromEntries([...videos.values()].map((v) => [v.code, v.url]))}
        habits={[{ id: "preview-1", title: "Use the Blinking Method every time you wake at night", circle: "Circadian Reset · Back to Sleep", color: "#7c9cff", prefill: "partly" }]}
        circles={(circles ?? []).map((c) => c.name as string)} closes="Mon 12 PM PST" timeLeft="2 days left"
        last={{ sleep: 6, energy: 5, stress: 7, hunger: 4 }} badWeek={{ already: false, left: 3 }} />
    </section>
  );
}
