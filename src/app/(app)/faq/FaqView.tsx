"use client";
import { useState } from "react";
import { ListIcon } from "@/components/ListIcon";
import type { FaqSection } from "@/lib/faq";

const Play = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>;
const Ext = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M19 14v5H5V5h5" /></svg>;

export default function FaqView({ sections }: { sections: FaqSection[] }) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState(sections[0]?.id ?? "");
  const needle = q.trim().toLowerCase();
  const match = (s: string | null | undefined) => !!s && s.toLowerCase().includes(needle);
  const list = needle
    ? sections.map((s) => ({ ...s, items: s.items.filter((i) => match(i.title) || match(i.body) || i.links.some((l) => match(l.label) || match(l.note))) })).filter((s) => s.items.length)
    : sections.filter((s) => s.id === tab);

  return (
    <div className="space-y-3.5">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search questions, foods, supplements…" aria-label="Search the FAQ"
        className="min-h-12 w-full rounded-2xl border border-[#2a2a2a] bg-card px-4 text-[15px] outline-none focus:border-accent" />
      {!needle && (
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {sections.map((s) => (
            <button key={s.id} type="button" onClick={() => setTab(s.id)} aria-pressed={tab === s.id}
              className={`min-h-10 shrink-0 rounded-full px-4 text-sm ${tab === s.id ? "bg-accent font-semibold text-black" : "border border-[#2a2a2a] text-[#d0d0d0]"}`}>{s.title}</button>
          ))}
        </div>
      )}
      {list.map((s) => (
        <div key={s.id} className="space-y-2.5">
          {needle ? <h2 className="pt-1 text-[11px] uppercase tracking-[0.15em] text-accent">{s.title}</h2> : s.intro && <p className="text-sm text-[#a8a8a8]">{s.intro}</p>}
          {s.items.map((i) => i.kind === "qa" ? (
            <details key={i.id} className="group rounded-2xl border border-border bg-card" open={!!needle}>
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3">
                <span className="flex-1 text-[15px] font-medium">{i.title}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="2" aria-hidden="true" className="shrink-0 transition group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
              </summary>
              <div className="space-y-3 px-4 pb-4">
                {i.body && <p className="whitespace-pre-line text-[15px] leading-relaxed text-[#d0d0d0]">{i.body}</p>}
                {i.video_url
                  ? <a href={i.video_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-black"><Play />Watch Michael&apos;s answer</a>
                  : <p className="text-xs text-dim">Video answer coming soon.</p>}
              </div>
            </details>
          ) : (
            <div key={i.id} className="rounded-2xl border border-border bg-card px-4 pb-1 pt-3.5">
              <div className="flex items-center gap-3">
                <ListIcon title={i.title} color="#f5a623" />
                <div className="min-w-0">
                  <p className="font-[family-name:var(--font-display)] text-[27px] uppercase leading-tight tracking-[0.02em]">{i.title}</p>
                  {i.body && <p className="text-[13px] text-[#a8a8a8]">{i.body}</p>}
                </div>
              </div>
              <ul className="mt-1 divide-y divide-border">
                {i.links.map((l, k) => (
                  <li key={k} className="flex min-h-12 items-center gap-3 py-2">
                    <span className="flex-1"><span className="block text-[15px]">{l.label}</span>{l.note && <span className="block text-xs text-dim">{l.note}</span>}</span>
                    {l.url && <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-accent px-3 text-[13px] font-semibold text-accent">Buy<Ext /></a>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
      {needle && !list.length && <p className="text-dim">Nothing found. Ask Michael in Chat.</p>}
    </div>
  );
}
