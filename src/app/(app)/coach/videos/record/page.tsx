import { createClient } from "@/lib/supabase/server";
import { loadVideos } from "@/lib/videos";
import { MEDAL_SCRIPTS } from "@/lib/medal-scripts";
import Teleprompter from "./Teleprompter";

/**
 * Coach → Videos → Record (November 21): Michael's laptop as a teleprompter. The script scrolls at the top of the
 * screen, right under the webcam, while it records; then one tap uploads it to its medal.
 */
export default async function RecordPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const supabase = await createClient();
  const have = await loadVideos(supabase);
  const codes = Object.keys(MEDAL_SCRIPTS);
  const { code } = await searchParams;
  const start = code && MEDAL_SCRIPTS[code] ? code : codes.find((c) => !have.has(c)) ?? codes[0];
  return <Teleprompter scripts={MEDAL_SCRIPTS} uploaded={codes.filter((c) => have.has(c))} start={start} />;
}
