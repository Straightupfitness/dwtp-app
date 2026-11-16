/**
 * November 15 (Michael): a small line drawing to the left of each section title on a client's page, as tall as the
 * title's letters. Drawn in the accent color.
 */
const P: Record<string, React.ReactNode> = {
  action: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="m3.5 6 1.5 1.5L7.5 5M3.5 12l1.5 1.5 2.5-2.5M3.5 18l1.5 1.5 2.5-2.5" /></>,
  activity: <path d="M3 12h4l3-7 4 14 3-7h4" />,
  food: <><path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10" /><path d="M17 21V3c-2.2 1.2-3.5 4-3.5 7.5V13H17" /></>,
  progress: <><path d="M3 20h18" /><path d="m4 16 5-5 4 3 7-8" /><path d="M15 6h5v5" /></>,
  circles: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /></>,
  workouts: <><path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" /></>,
  assessment: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>,
  checkins: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 11h6M9 15h4" /></>,
  badges: <><circle cx="12" cy="14" r="6" /><path d="M8.5 9 6 3h4l2 4 2-4h4l-2.5 6" /></>,
  targets: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5.5" /><path d="M12 12 20 4M16.5 4H20v3.5" /></>,
  details: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21c.8-4 3.8-6 7.5-6s6.7 2 7.5 6" /></>,
};

export default function SectionIcon({ name }: { name: keyof typeof P | string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className="inline-block size-[1em] shrink-0 text-accent">{P[name]}</svg>
  );
}
