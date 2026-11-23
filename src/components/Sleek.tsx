import Link from "next/link";

/**
 * November 23 (Michael): the small links under Today's cards ("Forgot yesterday?", "See my weight graph"…),
 * all one sleek look: a slim row with an icon on the left and an arrow on the right.
 */
// Light gray buttons with black text and an orange icon, so they stand out from the dark cards (Michael, Nov 23).
// Smaller and right-aligned at 3/4 width, so they read as "tap if you need it" (Michael, Nov 23).
export const sleekRow = "ml-auto flex min-h-8 w-3/4 items-center gap-2 rounded-lg bg-[#e8e8e8] px-2.5 py-1 text-[12px] font-semibold leading-tight text-black active:bg-[#d4d4d4]";
const Plus = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
export const Cal = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>;
const Chart = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 20h18" /><path d="m4 16 5-5 4 3 7-8" /></svg>;

export function SleekLink({ href, children, icon }: { href: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <Link href={href} className={sleekRow}>
      <span className="shrink-0 text-[#e8890c]">{icon ?? <Plus />}</span>
      <span className="min-w-0 flex-1">{children}</span>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" aria-hidden="true" className="shrink-0"><path d="M9 6l6 6-6 6" /></svg>
    </Link>
  );
}

/** A folded graph under a card, opened by a sleek row. */
export function SleekFold({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group/sleek -mt-1.5">
      <summary className={`${sleekRow} cursor-pointer list-none`}>
        <span className="shrink-0 text-[#e8890c]"><Chart /></span>
        <span className="min-w-0 flex-1">{label}</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" aria-hidden="true" className="shrink-0 transition group-open/sleek:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
      </summary>
      <div className="pt-2.5">{children}</div>
    </details>
  );
}
