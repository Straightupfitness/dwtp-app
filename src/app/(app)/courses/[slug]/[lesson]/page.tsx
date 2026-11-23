import Link from "next/link";
import { notFound } from "next/navigation";
import { bonusCourse } from "@/lib/bonus-courses";
import { createClient } from "@/lib/supabase/server";
import { loadVideos } from "@/lib/videos";
import BonusVideo from "@/components/BonusVideo";

const display = "font-[family-name:var(--font-display)] uppercase";

/** True only for Michael himself (in "See her app" the role is hers, so coach-only courses stay hidden there too). */
async function isCoach() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return data?.role === "coach";
}


/** November 22: one lesson of a bonus course: its videos and notes, then the next lesson. */
export default async function BonusLessonPage({ params }: { params: Promise<{ slug: string; lesson: string }> }) {
  const { slug, lesson } = await params;
  const c = bonusCourse(slug, await isCoach());
  const i = c?.lessons.findIndex((l) => l.slug === lesson) ?? -1;
  if (!c || i < 0) notFound();
  const l = c.lessons[i];
  const next = c.lessons[i + 1];
  const supabase = await createClient();
  const videos = l.blocks.some((b) => b.v.startsWith("code:")) ? await loadVideos(supabase) : new Map();
  return (
    <section className="space-y-4">
      <Link href={`/courses/${c.slug}`} className="inline-flex min-h-11 items-center text-sm text-dim">← {c.title}</Link>
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">{l.section ?? `Lesson ${i + 1} of ${c.lessons.length}`}</p>
        <h1 className={`${display} mt-1 text-[26px] font-semibold leading-tight`}>{l.title}</h1>
      </header>
      <div className="space-y-3">
        {l.blocks.map((b, k) => b.k === "video" ? <BonusVideo key={k} v={b.v} videos={videos} />
          : b.k === "link" ? <a key={k} href={b.v} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-between rounded-xl border border-accent px-4 text-[15px] font-semibold text-accent"><span>{b.t ?? "Open"}</span><span aria-hidden="true">↗</span></a>
          : b.k === "h" ? <h2 key={k} className={`${display} pt-2 text-[18px] text-accent`}>{b.v}</h2>
          : <p key={k} className="whitespace-pre-line text-[15px] leading-relaxed text-[#d6d6d6]">{b.v}</p>)}
      </div>
      {next
        ? <Link href={`/courses/${c.slug}/${next.slug}`} className="flex min-h-12 items-center justify-between rounded-2xl bg-accent px-4 font-semibold text-black"><span>Next: {next.title}</span><span aria-hidden="true">›</span></Link>
        : <Link href={`/courses/${c.slug}`} className="flex min-h-12 items-center justify-center rounded-2xl border border-border px-4 font-semibold">✓ Done. Back to the course</Link>}
    </section>
  );
}
