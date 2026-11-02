import BackButton from "@/components/BackButton";
import { BOOKING_URL } from "@/components/BookCall";

const display = "font-[family-name:var(--font-display)] uppercase";

/** Book an Ultimate Alignment call (November 2). */
export default function CallPage() {
  return (
    <section className="space-y-4">
      <BackButton fallback="/today" />
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">20 minutes · 1-on-1 with Michael</p>
        <h1 className={`${display} mt-1 text-[30px] font-semibold leading-tight`}>Ultimate Alignment call</h1>
      </header>
      <p className="text-[15px] leading-relaxed text-[#cfcfcf]">
        Stuck, off track, or something big coming up? Book 20 minutes with me and we&apos;ll get you realigned. Pick any open time.
      </p>
      <ul className="space-y-1.5 text-[14px] text-[#a8a8a8]">
        <li>• Before the call: jot down the 1–2 things you most want help with.</li>
        <li>• You&apos;ll get a confirmation and reminders by email and text.</li>
        <li>• Can&apos;t make it? Use the link in your confirmation to reschedule.</li>
      </ul>
      <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer"
        className="grid min-h-[54px] place-items-center rounded-[14px] bg-accent text-[17px] font-semibold text-black">Pick a time</a>
      <p className="text-center text-[12px] text-dim">Opens my calendar. Come back here when you&apos;re booked.</p>
    </section>
  );
}
