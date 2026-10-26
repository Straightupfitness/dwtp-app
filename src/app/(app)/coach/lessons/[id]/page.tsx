import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KIND_LABEL, type Lesson } from "@/lib/lessons";
import LessonEditor from "./LessonEditor";

export default async function EditLesson({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("lessons").select("id, kind, number, title, video_url, body, quiz, quiz_status, week_number").eq("id", id).maybeSingle();
  if (!data) notFound();
  const l = data as Lesson;
  return (
    <section className="space-y-4">
      <Link href="/coach/lessons" className="inline-flex min-h-11 items-center text-sm text-dim">← All lessons</Link>
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Week {l.week_number} · {KIND_LABEL[l.kind]}{l.kind !== "hh" ? ` ${l.number}` : ""}</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl uppercase">{l.title}</h1>
        <Link href={`/lessons/${l.id}`} className="text-sm text-accent">See it as she does →</Link>
      </header>
      <LessonEditor lesson={l} />
    </section>
  );
}
