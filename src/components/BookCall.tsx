import Link from "next/link";

/**
 * Michael's "Ultimate Alignment" call (November 2): 20 minutes, any time she needs it. Booking runs on his
 * GoHighLevel calendar (it already sends him the SMS and her the reminders); this is the way in from the app.
 */
export const BOOKING_URL = "https://straightupfitness.com/client-call";

export default function BookCall({ compact = false, sub = false }: { compact?: boolean; sub?: boolean }) {
  // November 23 (Michael): inside "Need help?" it's a slim card like the ones in "Your progress".
  if (sub) return (
    <Link href="/call" className="flex min-h-14 items-center gap-2 rounded-2xl border border-border bg-card px-4">
      <span className="flex flex-1 items-center gap-1.5 font-[family-name:var(--font-display)] text-[15px] font-medium uppercase leading-tight text-[#cfcfcf]">
        <span className="shrink-0 text-accent"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg></span>
        Book a call with Michael
      </span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="2" aria-hidden="true" className="shrink-0"><path d="M9 6l6 6-6 6" /></svg>
    </Link>
  );
  return (
    <Link href="/call" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#1f1708] text-accent">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">Book a call with Michael</span>
        {!compact && <span className="block text-[12px] text-[#a8a8a8]">20-minute Ultimate Alignment call, any time you need it</span>}
      </span>
      <span className="text-accent" aria-hidden="true">›</span>
    </Link>
  );
}
