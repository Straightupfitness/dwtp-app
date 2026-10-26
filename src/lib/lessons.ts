/**
 * Weekly lessons (decided October 25): Habits & Homework, Strong Body Wednesday, Strong Mind Friday.
 * Week 1 opens on her start date. Each next week's H&H opens once she submits the previous week's check-in.
 * That week's SBW opens on its Wednesday and SMF on its Friday (both only once the week's H&H is open).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { programWeek, todayIn } from "./program";

export const KIND_LABEL: Record<string, string> = { hh: "Habits & Homework", sbw: "Strong Body Wednesday", smf: "Strong Mind Friday" };
export type QuizQ = { q: string; options: string[]; correct: number };
export type Lesson = {
  id: string; kind: "hh" | "sbw" | "smf"; number: number; title: string; video_url: string | null; body: string | null;
  quiz: QuizQ[] | null; quiz_status: string; week_number: number | null;
};
export type LessonState = Lesson & {
  week: number; open: boolean; opensOn: string | null; lockedReason: string | null; watched: boolean; quizPassed: boolean; done: boolean;
};
export type Medal = { circle: string; slug: string; number: number; name: string; items: { title: string; type: string }[] };

const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
const dayName = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

export async function loadLessons(supabase: SupabaseClient, clientId: string, opts: { coach?: boolean } = {}) {
  const { data: p } = await supabase.from("profiles").select("program_start, timezone").eq("id", clientId).single();
  const today = todayIn(p?.timezone ?? "America/Los_Angeles");
  const start = p?.program_start ?? null;
  const current = programWeek(start, today);
  const [{ data: lessons }, { data: checkins }, { data: progress }] = await Promise.all([
    supabase.from("lessons").select("id, kind, number, title, video_url, body, quiz, quiz_status, week_number").not("week_number", "is", null).eq("retired", false),
    supabase.from("checkins").select("week_number").eq("client_id", clientId),
    supabase.from("lesson_progress").select("lesson_id, watched_at, quiz_passed_at").eq("client_id", clientId),
  ]);
  const checkedIn = new Set((checkins ?? []).map((c) => c.week_number as number));
  const prog = new Map((progress ?? []).map((r) => [r.lesson_id as string, r]));
  const order = { hh: 0, sbw: 1, smf: 2 } as const;

  const all: LessonState[] = ((lessons ?? []) as Lesson[]).map((l) => {
    const week = l.week_number!;
    const weekStart = start ? addDays(start, (week - 1) * 7) : null;
    const hhOpen = !!weekStart && (week === 1 ? today >= weekStart : checkedIn.has(week - 1));
    const opensOn = !weekStart ? null : l.kind === "sbw" ? addDays(weekStart, 2) : l.kind === "smf" ? addDays(weekStart, 4) : week === 1 ? weekStart : null;
    let open = hhOpen && (!opensOn || today >= opensOn);
    if (opts.coach) open = true;
    const lockedReason = open ? null
      : !start ? "Opens when your program starts"
      : !hhOpen ? (week === 1 ? `Opens ${dayName(weekStart!)}` : `Unlocks after your Week ${week - 1} check-in`)
      : `Opens ${dayName(opensOn!)}`;
    const pr = prog.get(l.id);
    const hasQuiz = l.quiz_status === "approved" && !!l.quiz?.length;
    const watched = !!pr?.watched_at, quizPassed = !!pr?.quiz_passed_at;
    return { ...l, week, open, opensOn, lockedReason, watched, quizPassed, done: watched && (!hasQuiz || quizPassed) };
  }).sort((a, b) => a.week - b.week || order[a.kind] - order[b.kind]);

  const weeks = Array.from(new Set(all.map((l) => l.week))).sort((a, b) => a - b)
    .map((w) => ({ week: w, lessons: all.filter((l) => l.week === w) }));
  return { today, current, weeks, all };
}

/** The medals and habits a week of the trajectory starts: the written H&H. */
export async function weekMedals(supabase: SupabaseClient, week: number): Promise<Medal[]> {
  const { data } = await supabase.from("trajectory_week_rings")
    .select("rings(name, ring_number, circles(name, slug), ring_items(title, item_type, sort))").eq("week_number", week);
  type R = { name: string; ring_number: number; circles: { name: string; slug: string } | null; ring_items: { title: string; item_type: string; sort: number }[] };
  return ((data ?? []) as unknown as { rings: R | null }[]).map((x) => x.rings).filter((r): r is R => !!r).map((r) => ({
    circle: r.circles?.name ?? "", slug: r.circles?.slug ?? "", number: r.ring_number, name: r.name,
    items: [...r.ring_items].sort((a, b) => a.sort - b.sort).map((i) => ({ title: i.title, type: i.item_type })),
  }));
}

/** A YouTube or Wistia link as an embeddable player URL. */
export function embedUrl(url: string | null): string | null {
  if (!url) return null;
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0&modestbranding=1&playsinline=1`;
  const wi = url.match(/wistia\.(?:com|net)\/(?:medias|embed\/iframe)\/(\w+)/);
  if (wi) return `https://fast.wistia.net/embed/iframe/${wi[1]}`;
  return null;
}
