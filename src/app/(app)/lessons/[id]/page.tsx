import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { embedUrl, KIND_LABEL, loadLessons, weekMedals } from "@/lib/lessons";
import { circleColor } from "@/lib/circles";
import LessonActions from "./LessonActions";

const display = "font-[family-name:var(--font-display)] uppercase";

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  const coach = me?.role === "coach";
  const { all } = await loadLessons(supabase, user!.id, { coach });
  const l = all.find((x) => x.id === id);
  if (!l) notFound();
  if (!l.open) {
    return (
      <section className="space-y-4">
        <Link href="/lessons" className="inline-flex min-h-11 items-center text-sm text-dim">← Lessons</Link>
        <h1 className={`${display} text-2xl`}>{l.title}</h1>
        <p className="rounded-2xl border border-border bg-card p-4 text-[15px] text-[#a8a8a8]">{l.lockedReason}.</p>
      </section>
    );
  }
  const medals = l.kind === "hh" ? await weekMedals(supabase, l.week) : [];
  const embed = embedUrl(l.video_url);
  const quiz = l.quiz_status === "approved" ? l.quiz ?? [] : [];

  return (
    <section className="space-y-4">
      <Link href="/lessons" className="inline-flex min-h-11 items-center text-sm text-dim">← Lessons</Link>
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Week {l.week} · {KIND_LABEL[l.kind]}{l.kind !== "hh" ? ` ${l.number}` : ""}</p>
        <h1 className={`${display} mt-1 text-[28px] font-semibold leading-tight`}>{l.title}</h1>
      </header>

      {embed ? (
        <div className="aspect-video overflow-hidden rounded-2xl border border-border bg-black">
          <iframe src={embed} title={l.title} className="size-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />
        </div>
      ) : l.kind === "hh" ? (
        <p className="rounded-2xl border border-dashed border-[#2a2a2a] p-4 text-center text-sm text-dim">Michael&apos;s video for this week is coming soon. Everything you need is below.</p>
      ) : null}

      {medals.length > 0 && (
        <div className="space-y-2.5">
          <h2 className="text-[11px] uppercase tracking-[0.15em] text-accent">Your new habits this week</h2>
          {medals.map((m) => {
            const color = circleColor(m.slug);
            return (
              <Link key={`${m.slug}-${m.number}`} href={`/circles/${m.slug}`} className="block rounded-2xl border border-border bg-card p-3.5">
                <p className="text-[11px] uppercase tracking-[0.1em]" style={{ color }}>{m.circle} · Medal {m.number}</p>
                <p className={`${display} text-[19px] leading-tight`}>{m.name}</p>
                <ul className="mt-2 space-y-1.5">
                  {m.items.map((i) => (
                    <li key={i.title} className="flex gap-2 text-[15px] leading-snug">
                      <span className="mt-[7px] size-1.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />{i.title}
                    </li>
                  ))}
                </ul>
              </Link>
            );
          })}
        </div>
      )}

      {l.body && (
        <div className="space-y-3 text-[15px] leading-relaxed text-[#d8d8d8]">
          {l.body.split(/\n\s*\n/).map((para, i) => <p key={i} className="whitespace-pre-line">{para}</p>)}
        </div>
      )}

      <LessonActions lessonId={l.id} kind={l.kind} watched={l.watched} quizPassed={l.quizPassed}
        quiz={quiz.map((q) => ({ q: q.q, options: q.options }))} coach={coach} />
    </section>
  );
}
