import Link from "next/link";

/**
 * November 23 (Michael): the small links under Today's cards ("Forgot yesterday?", "See my weight graph"…),
 * all one sleek look: a slim row with an icon on the left and an arrow on the right.
 */
export const sleekRow = "flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-[#2a2a2a] bg-[#161616] px-3 text-[13px] font-medium text-[#d6d6d6]";
const Plus = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
const Chart = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 20h18" /><path d="m4 16 5-5 4 3 7-8" /></svg>;

export function SleekLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={sleekRow}>
      <span className="shrink-0 text-accent"><Plus /></span>
      <span className="min-w-0 flex-1">{children}</span>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="2" aria-hidden="true" className="shrink-0"><path d="M9 6l6 6-6 6" /></svg>
    </Link>
  );
}

/** A folded graph under a card, opened by a sleek row. */
export function SleekFold({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group/sleek">
      <summary className={`${sleekRow} cursor-pointer list-none`}>
        <span className="shrink-0 text-accent"><Chart /></span>
        <span className="min-w-0 flex-1">{label}</span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="2" aria-hidden="true" className="shrink-0 transition group-open/sleek:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
      </summary>
      <div className="pt-2.5">{children}</div>
    </details>
  );
}
