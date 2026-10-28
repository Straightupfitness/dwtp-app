import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Uploader from "./Uploader";

export default async function ClipsPage() {
  const supabase = await createClient();
  const [{ count: clips }, { data: stored }] = await Promise.all([
    supabase.from("exercises").select("id", { count: "exact", head: true }).not("clip_path", "is", null),
    supabase.storage.from("exercise-clips").list("sltp", { limit: 2000 }),
  ]);
  const have = (stored ?? []).filter((f) => f.name.endsWith(".mp4")).length;
  return (
    <section className="space-y-4">
      <Link href="/coach" className="inline-flex min-h-11 items-center text-sm text-dim">← Clients</Link>
      <header>
        <p className="text-xs uppercase tracking-[0.15em] text-accent">Coach</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl uppercase">Exercise clips</h1>
        <p className="mt-1 text-sm text-dim">{have} of {clips ?? 0} clips are in the app. Upload the folder once; uploading again replaces the same files.</p>
      </header>
      <Uploader />
      <Link href="/workouts" className="inline-flex min-h-11 items-center text-sm text-accent">See the workouts as a client sees them →</Link>
    </section>
  );
}
