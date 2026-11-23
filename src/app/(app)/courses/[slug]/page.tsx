import Link from "next/link";
import { notFound } from "next/navigation";
import { bonusCourse } from "@/lib/bonus-courses";

const display = "font-[family-name:var(--font-display)] uppercase";

/** November 22: one bonus course: what it is and its lessons. */
export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = bonusCourse(slug);
  if (!c) notFound();
  const heads = c.lessons.map((l, i) => (l.section && l.section !== c.lessons[i - 1]?.section ? l.section : null));
  return (
    <section className="space-y-4">
      <Link href="/lessons#bonus" className="inline-flex min-h-11 items-center text-sm text-dim">← Lessons</Link>
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Bonus course</p>
        <h1 className={`${display} mt-1 text-[28px] font-semibold leading-tight`}>{c.title}</h1>
        <p className="mt-1 text-[15px] text-[#cfcfcf]">{c.blurb}</p>
      </header>
      {c.intro && c.intro.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
          {c.intro.map((b, i) => b.k === "h" ? <h2 key={i} className="text-[16px] font-semibold">{b.v}</h2> : b.k === "p" ? <p key={i} className="whitespace-pre-line text-[14px] leading-relaxed text-[#cfcfcf]">{b.v}</p> : null)}
        </div>
      )}
      <ol className="divide-y divide-border rounded-2xl border border-border bg-card">
        {c.lessons.map((l, i) => {
          const head = heads[i];
          return (
            <li key={l.slug}>
              {head && <p className="border-b border-border bg-[#141414] px-3.5 py-2 text-[11px] uppercase tracking-[0.12em] text-accent">{head}</p>}
              <Link href={`/courses/${c.slug}/${l.slug}`} className="flex min-h-14 items-center gap-3 px-3.5 py-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-[13px] font-semibold text-dim">{i + 1}</span>
                <span className="flex-1 text-[15px]">{l.title}</span>
                <span className="text-dim" aria-hidden="true">›</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
