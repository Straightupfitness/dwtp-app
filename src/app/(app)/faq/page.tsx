import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadFaq } from "@/lib/faq-server";
import FaqView from "./FaqView";
import { loadSearchIndex } from "@/lib/app-search";
import { BONUS_COURSES } from "@/lib/bonus-courses";
import { COACH_COURSES } from "@/lib/coach-courses";
import OpenOnHash from "@/components/OpenOnHash";

const display = "font-[family-name:var(--font-display)] uppercase";

export default async function FaqPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: me }, sections, index] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user!.id).single(), loadFaq(supabase), loadSearchIndex(supabase),
  ]);
  return (
    <section className="space-y-3.5">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Search the app, answers, lists and links</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-[30px] font-semibold uppercase">Search &amp; FAQ</h1>
        </div>
        {me?.role === "coach" && <Link href="/coach/faq" className="min-h-11 pt-3 text-sm text-accent">Edit FAQ</Link>}
      </header>
      {/* November 22 (Michael): his old Xperiencify courses, folded. November 23: moved from Lessons to the top of Search & FAQ. */}
      <details id="bonus" className="group scroll-mt-20 rounded-2xl border border-border bg-card">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-3.5">
          <span aria-hidden="true">🎁</span>
          <span className={`${display} flex-1 text-[17px]`}>Bonus courses</span>
          <span className="text-xs text-dim">{BONUS_COURSES.length}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="2" aria-hidden="true" className="transition group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
        </summary>
        <div className="divide-y divide-border border-t border-border">
          {BONUS_COURSES.map((c) => (
            <Link key={c.slug} href={`/courses/${c.slug}`} className="flex min-h-14 items-center gap-3 px-3.5 py-2">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">{c.title}</span>
                <span className="block truncate text-[12px] text-dim">{c.lessons.length} {c.lessons.length === 1 ? "lesson" : "lessons"} · {c.blurb}</span>
              </span>
              <span className="text-dim" aria-hidden="true">›</span>
            </Link>
          ))}
          {/* Coach-only courses: only Michael sees these rows (clients never get them). */}
          {me?.role === "coach" && COACH_COURSES.map((c) => (
            <Link key={c.slug} href={`/courses/${c.slug}`} className="flex min-h-14 items-center gap-3 bg-[#141008] px-3.5 py-2">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">🔒 {c.title}</span>
                <span className="block truncate text-[12px] text-dim">Only you can see this · {c.lessons.length} lessons</span>
              </span>
              <span className="text-dim" aria-hidden="true">›</span>
            </Link>
          ))}
        </div>
      </details>
      <OpenOnHash ids={["bonus"]} />
      <FaqView sections={sections} index={index} />
      <Link href="/chat" className="flex min-h-12 items-center justify-center rounded-2xl border border-border text-sm">Didn&apos;t find it? Ask Michael</Link>
    </section>
  );
}
