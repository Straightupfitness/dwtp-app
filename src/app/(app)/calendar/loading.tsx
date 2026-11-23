/** November 23: the scrolling calendar loads every week of her program, so it shows this while it does. */
export default function Loading() {
  return (
    <section className="space-y-3.5" aria-busy="true">
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Your workouts, lessons and calls</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[30px] font-semibold uppercase">Calendar</h1>
      </header>
      {Array.from({ length: 5 }, (_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl border border-border bg-card" />)}
    </section>
  );
}
