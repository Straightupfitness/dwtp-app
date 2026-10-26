import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KIND_LABEL, type Lesson } from "@/lib/lessons";

const STATUS = { none: ["No quiz", "text-dim border-border"], draft: ["Quiz draft", "text-accent border-accent"], approved: ["Quiz live", "text-[#7ee2a8] border-[#1f3a2a]"] } as const;

/** Every week's lessons, for Michael: add videos, edit text, draft and approve quizzes. */
export default async function CoachLessons() {
  const supabase = await createClient();
  const { data } = await supabase.from("lessons").select("id, kind, number, title, video_url, body, quiz, quiz_status, week_number")
    .not("week_number", "is", null).order("week_number");
  const lessons = (data ?? []) as Lesson[];
  const order = { hh: 0, sbw: 1, smf: 2 };
  const weeks = Array.from(new Set(lessons.map((l) => l.week_number!))).sort((a, b) => a - b);
  const missingVideo = lessons.filter((l) => l.kind !== "smf" && !l.video_url).length;
  const toApprove = lessons.filter((l) => l.quiz_status !== "approved").length;

  return (
    <section className="space-y-4">
      <Link href="/coach" className="inline-flex min-h-11 items-center text-sm text-dim">← Clients</Link>
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Weeks 1–26</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl uppercase">Lessons</h1>
        <p className="mt-1 text-sm text-dim">{missingVideo} H&amp;H and SBW lessons without a video · {toApprove} quizzes not live yet</p>
      </header>
      {weeks.map((w) => (
        <div key={w} className="space-y-1.5">
          <h2 className="text-[11px] uppercase tracking-[0.15em] text-accent">Week {w}</h2>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {lessons.filter((l) => l.week_number === w).sort((a, b) => order[a.kind] - order[b.kind]).map((l) => {
              const [label, cls] = STATUS[(l.quiz_status as keyof typeof STATUS) ?? "none"];
              return (
                <li key={l.id}>
                  <Link href={`/coach/lessons/${l.id}`} className="flex min-h-14 items-center gap-3 px-3.5 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] uppercase tracking-[0.1em] text-dim">{KIND_LABEL[l.kind]}{l.kind !== "hh" ? ` ${l.number}` : ""}</span>
                      <span className="block truncate text-[15px]">{l.title}</span>
                      {l.kind !== "smf" && !l.video_url && <span className="block text-xs text-[#ff8a7e]">No video yet</span>}
                    </span>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${cls}`}>{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
