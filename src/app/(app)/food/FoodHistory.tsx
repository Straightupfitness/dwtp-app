import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadDaily } from "@/lib/daily";
import DailyCombo from "@/components/DailyCombo";
import OpenOnHash from "@/components/OpenOnHash";
import Fold from "@/components/Fold";

export const RANGES = [7, 14, 30, 90] as const;

/**
 * November 23 (Michael): "Your previous logs", what used to be "Food, day by day" on the Progress tab, folded at the bottom of Food.
 * One graph per number (calories, protein, fiber, potassium, alcohol, water), each with her target on it.
 */
export default async function FoodHistory({ userId, range, day, open }: { userId: string; range: number; day: string | null; open: boolean }) {
  const supabase = await createClient();
  const data = await loadDaily(supabase, userId, range);
  const href = (r: number) => `/food?${day ? `d=${day}&` : ""}r=${r}#history`;
  return (
    <Fold id="history" variant="card" forceOpen={open} title="Your previous logs" sub="Calories, protein, fiber, potassium, alcohol and water, day by day">
        <nav className="flex gap-1.5" aria-label="How many days">
          {RANGES.map((r) => (
            <Link key={r} href={href(r)} scroll={false} aria-current={r === range ? "true" : undefined}
              className={`grid min-h-9 flex-1 place-items-center rounded-full border text-[13px] font-semibold ${r === range ? "border-accent bg-accent text-black" : "border-border text-[#a8a8a8]"}`}>{r} days</Link>
          ))}
        </nav>
        <DailyCombo days={data.days} goals={data.goals} only={["cal", "pro", "fib", "pot", "alc", "wat"]} />
        <p className="text-[11px] text-dim">Solid bar = on target · faded = under it · red = over your calories. Dashed line = your target. Alcohol counts the calories of every drink you log.</p>
      <OpenOnHash ids={["history"]} />
    </Fold>
  );
}
