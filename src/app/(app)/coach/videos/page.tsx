import { createClient } from "@/lib/supabase/server";
import { loadVideos, VIDEO_SETS } from "@/lib/videos";
import VideoUploader from "./VideoUploader";

/**
 * Coach → Videos (November 9): drop a whole folder of videos and each one goes to its place by its file name
 * (ONB-01.mp4, 7X-05.mp4, CHK-02.mp4, MED-14.mp4). Shows what's uploaded and what's still missing.
 */
export default async function VideosPage() {
  const supabase = await createClient();
  const probe = await supabase.from("program_videos").select("code").limit(1);
  const have = await loadVideos(supabase);
  const sets = VIDEO_SETS.map((s) => ({ ...s, codes: s.codes.map((c) => ({ code: c, video: have.get(c) ?? null })) }));
  const extra = [...have.values()].filter((v) => !VIDEO_SETS.some((s) => s.codes.includes(v.code)));
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.15em] text-accent">Coach</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl uppercase">Videos</h1>
        <p className="text-sm"><a href="/coach/checkin-preview" className="font-semibold text-accent">Preview the check-in with your videos ›</a></p>
        <p className="text-sm text-dim">Drop your videos here, a whole folder at once. Each one goes to its place by its file name, like CHK-02.mp4. Uploading a code again replaces it.</p>
      </header>
      {probe.error && <p className="rounded-xl border border-[#3a3020] bg-[#161310] p-3 text-sm text-[#d9c9a8]">Run <b>SQL 16 (program videos)</b> in Supabase before uploading.</p>}
      <VideoUploader sets={sets} extra={extra} />
    </section>
  );
}
