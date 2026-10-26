import Link from "next/link";
import { KIND_LABEL, type LessonState } from "@/lib/lessons";

const KIND_COLOR: Record<string, string> = { hh: "#f5a623", sbw: "#22c55e", smf: "#c084fc" };

/** One lesson in a list: what kind, its title, and done / new / when it opens. */
export default function LessonRow({ l }: { l: LessonState }) {
  const inner = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-full border-2"
        style={l.done ? { background: KIND_COLOR[l.kind], borderColor: KIND_COLOR[l.kind] } : { borderColor: l.open ? KIND_COLOR[l.kind] : "#333" }}>
        {l.done ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
          : l.open ? <svg width="13" height="13" viewBox="0 0 24 24" fill={KIND_COLOR[l.kind]} aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] uppercase tracking-[0.1em]" style={{ color: l.open ? KIND_COLOR[l.kind] : "#777" }}>{KIND_LABEL[l.kind]}</span>
        <span className={`block text-[15px] leading-snug ${l.open ? "" : "text-[#8a8a8a]"}`}>{l.title}</span>
        {!l.open && <span className="block text-xs text-dim">{l.lockedReason}</span>}
      </span>
      {l.open && !l.done && <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-black">New</span>}
    </>
  );
  return l.open
    ? <Link href={`/lessons/${l.id}`} className="flex min-h-16 items-center gap-3 px-3.5 py-2.5">{inner}</Link>
    : <div className="flex min-h-16 items-center gap-3 px-3.5 py-2.5" aria-disabled="true">{inner}</div>;
}
