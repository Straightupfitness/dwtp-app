"use client";
import { useEffect, useRef } from "react";

const display = "font-[family-name:var(--font-display)] uppercase";

/**
 * November 23 (Michael): a folded section that remembers, on her phone, whether she left it open or closed.
 * "title" looks like "Track your numbers" (icon + display title, no box); "card" looks like "Your previous logs" on Food;
 * "sub" looks like the cards inside Today's sections ("How many steps did you get yesterday?").
 */
export default function Fold({ id, title, icon, sub, right, under, defaultOpen = false, forceOpen = false, variant = "title", children }: {
  id: string; title: React.ReactNode; icon?: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode;
  /** Shown under the title even when folded (her habits' progress bar). */
  under?: React.ReactNode;
  defaultOpen?: boolean; forceOpen?: boolean; variant?: "title" | "card" | "sub"; children: React.ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const key = `fold:${id}`;
  useEffect(() => {
    const el = ref.current;
    if (!el || forceOpen) return;
    try { const v = localStorage.getItem(key); if (v !== null) el.open = v === "1"; } catch { /* private mode: use the default */ }
  }, [key, forceOpen]);
  const toggle = () => { try { localStorage.setItem(key, ref.current?.open ? "1" : "0"); } catch { /* ignore */ } };
  const chev = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="2" aria-hidden="true" className="shrink-0 transition group-open/fold:rotate-180"><path d="M6 9l6 6 6-6" /></svg>;

  if (variant === "sub") return (
    <details id={id} ref={ref} open={defaultOpen || forceOpen} onToggle={toggle} className="group/fold scroll-mt-20 rounded-2xl border border-border bg-card">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 px-4">
        <span className={`${display} flex flex-1 items-center gap-1.5 text-[15px] font-medium leading-tight text-[#cfcfcf]`}>{icon && <span className="shrink-0 text-accent">{icon}</span>}{title}</span>
        {right}
        {chev}
      </summary>
      <div className="space-y-3 px-3 pb-3">{children}</div>
    </details>
  );

  if (variant === "card") return (
    <details id={id} ref={ref} open={defaultOpen || forceOpen} onToggle={toggle} className="group/fold scroll-mt-20 overflow-hidden rounded-[18px] border border-border bg-card">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4">
        {icon && <span className="shrink-0 text-accent">{icon}</span>}
        <span className="flex-1 py-2">
          <span className={`${display} block text-lg leading-tight`}>{title}</span>
          {sub && <span className="block text-[12px] text-dim">{sub}</span>}
        </span>
        {right}
        {chev}
      </summary>
      <div className="space-y-3 px-4 pb-4">{children}</div>
    </details>
  );

  return (
    <details id={id} ref={ref} open={defaultOpen || forceOpen} onToggle={toggle} className="group/fold scroll-mt-20">
      <summary className="cursor-pointer list-none pt-1">
        <span className="flex min-h-11 items-center gap-2">
          <span className={`${display} flex flex-1 items-center gap-1.5 text-lg font-medium`}>{icon && <span className="text-accent">{icon}</span>}{title}</span>
          {right}
          {chev}
        </span>
        {under}
      </summary>
      <div className="space-y-3.5 pt-2.5">{children}</div>
    </details>
  );
}
