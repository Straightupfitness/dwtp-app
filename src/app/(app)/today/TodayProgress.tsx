import { createClient } from "@/lib/supabase/server";
import { progressFor } from "@/lib/badges-server";
import { BadgesCard, WeightCard } from "@/components/ProgressView";
import CirclesSection from "@/components/CirclesSection";
import ProgressPhotos from "@/components/ProgressPhotos";
import OpenOnHash from "@/components/OpenOnHash";
import { loadProgressPhotos } from "@/lib/progress-photos";
import type { ProgramState } from "@/lib/circles";

const display = "font-[family-name:var(--font-display)] uppercase";

/**
 * November 23 (Michael): what used to be the Progress tab, folded into Today near the bottom: her circles, her weight
 * with her goal weight, her progress photos and her badges. Food and water day by day moved to the Food tab, steps
 * under her steps card. Opening Today also awards any badge she has just earned (so it shows in Community).
 */
export default async function TodayProgress({ userId, state, today }: { userId: string; state: ProgramState; today: string }) {
  const supabase = await createClient();
  const [{ data, status }, photos] = await Promise.all([progressFor(supabase, userId), loadProgressPhotos(supabase, userId)]);
  const earned = status.filter((b) => b.earned).length;
  return (
    <details id="progress" className="group scroll-mt-20 rounded-[18px] border border-border bg-card">
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4">
        <span className="flex-1">
          <span className={`${display} block text-lg leading-tight`}>Your progress</span>
          <span className="block text-[12px] text-dim">Circles, weight, photos and badges ({earned} of {status.length} earned)</span>
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="2" aria-hidden="true" className="shrink-0 transition group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
      </summary>
      <div className="space-y-4 px-3 pb-3">
        <CirclesSection state={state} />
        <WeightCard data={data} />
        <ProgressPhotos photos={photos} userId={userId} today={today} />
        <div id="badges" className="scroll-mt-20"><BadgesCard badges={status} /></div>
      </div>
      <OpenOnHash ids={["progress", "circles", "photos", "badges", "weight-graph"]} />
    </details>
  );
}
