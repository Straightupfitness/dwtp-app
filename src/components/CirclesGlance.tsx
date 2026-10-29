import Link from "next/link";
import type { ProgramState } from "@/lib/circles";
import { Medals, pct } from "./CirclesSection";

/** A small look at her circles on Today (October 29): the ones she's working on, with their medals. Opens Progress. */
export default function CirclesGlance({ state }: { state: ProgramState }) {
  const open = state.circles.filter((c) => c.focus || c.status === "open")
    .sort((a, b) => Number(b.focus) - Number(a.focus));
  if (!open.length) return null;
  const all = state.circles.filter((c) => c.kind === "growth");
  const medals = all.reduce((n, c) => n + c.ringsComplete, 0), total = all.reduce((n, c) => n + c.rings.length, 0);
  return (
    <Link href="/progress#circles" className="block space-y-2.5 rounded-2xl border border-border bg-card p-3">
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-[family-name:var(--font-display)] text-[17px] font-medium uppercase leading-none">Your circles</span>
        <span className="text-[12px] text-dim"><b className="text-text">{medals}</b> of {total} medals <span aria-hidden="true">›</span></span>
      </span>
      <span className="flex gap-3 overflow-x-auto pb-0.5 [scrollbar-width:none]">
        {open.map((c) => (
          <span key={c.id} className="flex w-[64px] shrink-0 flex-col items-center gap-1 text-center">
            <Medals c={c} size={52} center />
            <span className="w-full truncate text-[10px] font-semibold uppercase tracking-[0.04em]" style={{ color: c.color }}>{c.name}</span>
            <span className="text-[10px] leading-none text-dim">{pct(c)}%</span>
          </span>
        ))}
      </span>
    </Link>
  );
}
