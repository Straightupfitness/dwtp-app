import { createClient } from "@/lib/supabase/server";
import { loadVideos } from "@/lib/videos";
import { MEDAL_SCRIPTS } from "@/lib/medal-scripts";
import { HH_SCRIPTS } from "@/lib/hh-scripts";
import Teleprompter from "./Teleprompter";

const SETS = { med: { label: "Medals", scripts: MEDAL_SCRIPTS }, hh: { label: "Habits & Homework", scripts: HH_SCRIPTS } } as const;

/**
 * Coach → Videos → Record (November 21): Michael's laptop as a teleprompter. The script scrolls at the top of the
 * screen, right under the webcam, while it records; then one tap uploads it to its medal. November 26: the Habits &
 * Homework scripts (HH-05 … HH-26) as a second set (?set=hh), and a Prompter view for his Elgato Prompter.
 */
export default async function RecordPage({ searchParams }: { searchParams: Promise<{ code?: string; set?: string }> }) {
  const supabase = await createClient();
  const have = await loadVideos(supabase);
  const sp = await searchParams;
  const set = sp.set === "hh" || sp.code?.startsWith("HH-") ? "hh" : "med";
  const scripts = SETS[set].scripts;
  const codes = Object.keys(scripts);
  const start = sp.code && scripts[sp.code] ? sp.code : codes.find((c) => !have.has(c)) ?? codes[0];
  return <Teleprompter key={set} scripts={scripts} uploaded={codes.filter((c) => have.has(c))} start={start} set={set}
    sets={Object.entries(SETS).map(([key, v]) => ({ key, label: v.label }))} />;
}
