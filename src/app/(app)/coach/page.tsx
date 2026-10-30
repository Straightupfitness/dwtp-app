import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadRoster } from "@/lib/roster";
import RosterView from "./RosterView";

/**
 * Michael's client overview (October 29): every client's snapshot on one screen, filters for who needs a nudge,
 * and personal messages to many at once.
 */
export default async function CoachHome() {
  const supabase = await createClient();
  const rows = await loadRoster(supabase);
  const toReply = rows.filter((r) => r.checkin?.state === "needs-reply").length;
  return (
    // Wider than the phone column on a computer, so a row of numbers fits.
    <section className="space-y-4 md:relative md:left-1/2 md:w-[min(1080px,calc(100vw-3rem))] md:-translate-x-1/2">
      <header>
        <p className="text-xs uppercase tracking-[0.15em] text-accent">Coach</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl uppercase">Clients</h1>
        <p className="text-sm text-dim">{toReply ? `${toReply} check-in${toReply > 1 ? "s" : ""} to reply to` : "All caught up"} · {rows.length} clients</p>
      </header>
      <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
        <Link href="/coach/calendar" className="flex min-h-11 items-center justify-center rounded-xl border border-border text-sm font-semibold">Calendar</Link>
        <Link href="/coach/lessons" className="flex min-h-11 items-center justify-center rounded-xl border border-border text-sm font-semibold">Lessons</Link>
        <Link href="/coach/clips" className="flex min-h-11 items-center justify-center rounded-xl border border-border text-sm font-semibold">Clips &amp; recipes</Link>
        <Link href="/coach/activity" className="flex min-h-11 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-black">Activity</Link>
        <Link href="/coach/clients/new" className="flex min-h-11 items-center justify-center rounded-xl border border-accent text-sm font-semibold text-accent">+ Add client</Link>
      </div>
      <RosterView rows={rows} />
    </section>
  );
}
