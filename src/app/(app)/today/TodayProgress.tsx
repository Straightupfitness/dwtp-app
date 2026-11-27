import { createClient } from "@/lib/supabase/server";
import { progressFor } from "@/lib/badges-server";
import { loadDaily } from "@/lib/daily";
import { toUnit, type WeightUnit } from "@/lib/units";
import { BadgesCard, WeightCard } from "@/components/ProgressView";
import CirclesSection from "@/components/CirclesSection";
import ProgressPhotos from "@/components/ProgressPhotos";
import OpenOnHash from "@/components/OpenOnHash";
import Fold from "@/components/Fold";
import { SleekFold } from "@/components/Sleek";
import SectionIcon from "@/components/SectionIcon";
import { loadProgressPhotos } from "@/lib/progress-photos";
import type { ProgramState } from "@/lib/circles";

/**
 * November 23 (Michael), second pass: near the bottom of Today, a folded "Your progress" holding three folded cards:
 * Your Capacity Circles, Progress photos, Badges. Each remembers whether she left it open. Opening Today also awards
 * any badge she has just earned (so it shows in Community).
 */
export default async function TodayProgress({ userId, state, today, started }: { userId: string; state: ProgramState; today: string; started: boolean }) {
  const supabase = await createClient();
  const [{ status }, photos] = await Promise.all([progressFor(supabase, userId), loadProgressPhotos(supabase, userId)]);
  const earned = status.filter((b) => b.earned).length;
  const count = (t: string) => <span className="text-[13px] text-[#a8a8a8]">{t}</span>;
  return (
    <Fold id="progress" title="Your progress" icon={<SectionIcon name="progress" />}>
      {started && (
        <Fold id="capacity-circles" variant="sub" title="Capacity Circles" icon={<SectionIcon name="circles" />}>
          <CirclesSection state={state} noTitle />
        </Fold>
      )}
      <Fold id="progress-photos" variant="sub" title="Progress photos" icon={<SectionIcon name="photos" />} right={photos.length ? count(`${photos.length}`) : null}>
        <ProgressPhotos photos={photos} userId={userId} today={today} noTitle />
      </Fold>
      <Fold id="badges" variant="sub" title="Badges" icon={<SectionIcon name="badges" />} right={count(`${earned} of ${status.length} earned`)}>
        <BadgesCard badges={status} noTitle />
      </Fold>
      <OpenOnHash ids={["progress", "capacity-circles", "circles", "photos", "progress-photos", "badges", "weight-graph"]} />
    </Fold>
  );
}

/** Her weight graph with her goal-weight line, folded under the weigh-in card. */
export async function TodayWeight({ userId, unit = "lbs" }: { userId: string; unit?: WeightUnit }) {
  const supabase = await createClient();
  const raw = await loadDaily(supabase, userId);
  // November 26: in her unit (lbs or kg).
  const cv = (n: number | null) => (n == null ? n : toUnit(n, unit));
  const data = unit === "lbs" ? raw : { ...raw, weights: raw.weights.map((w) => ({ ...w, lbs: toUnit(w.lbs, unit) })),
    goals: { ...raw.goals, goalWeight: cv(raw.goals.goalWeight), startWeight: cv(raw.goals.startWeight) } };
  if (!data.weights.length) return null;
  return (
    <SleekFold label="See my weight graph"><WeightCard data={data} unit={unit} /></SleekFold>
  );
}
