import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadFaq } from "@/lib/faq-server";
import { ItemEditor, SectionEditor } from "./Editors";

export default async function CoachFaq() {
  const supabase = await createClient();
  const sections = await loadFaq(supabase);
  return (
    <section className="space-y-5">
      <Link href="/faq" className="inline-flex min-h-11 items-center text-sm text-dim">← FAQ</Link>
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Coach</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[30px] font-semibold uppercase">Edit the FAQ</h1>
        <p className="text-sm text-[#a8a8a8]">Questions get a short written answer and a link to your video. Lists get a buy link per item. Changes show for every client right away.</p>
      </header>
      {sections.map((s) => (
        <div key={s.id} className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <SectionEditor section={s} />
          <div className="space-y-2">
            {s.items.map((i) => (
              <details key={i.id} className="rounded-xl border border-border bg-bg">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2">
                  <span className="text-sm">{i.title}</span>
                  <span className="shrink-0 text-xs text-dim">{i.kind === "qa" ? (i.video_url ? "video ✓" : "no video yet") : `${i.links.filter((l) => l.url).length}/${i.links.length} links`}</span>
                </summary>
                <div className="px-3 pb-3"><ItemEditor item={i} sectionId={s.id} kind={i.kind} /></div>
              </details>
            ))}
            <details className="rounded-xl border border-dashed border-[#2f2f2f]">
              <summary className="min-h-12 cursor-pointer list-none px-3 py-3 text-sm text-accent">+ Add a question</summary>
              <div className="px-3 pb-3"><ItemEditor sectionId={s.id} kind="qa" /></div>
            </details>
            <details className="rounded-xl border border-dashed border-[#2f2f2f]">
              <summary className="min-h-12 cursor-pointer list-none px-3 py-3 text-sm text-accent">+ Add a list</summary>
              <div className="px-3 pb-3"><ItemEditor sectionId={s.id} kind="list" /></div>
            </details>
          </div>
        </div>
      ))}
      <div className="rounded-2xl border border-dashed border-[#2f2f2f] p-4"><SectionEditor /></div>
    </section>
  );
}
