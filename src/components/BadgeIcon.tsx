import { BADGE, type BadgeKey } from "@/lib/badges";

const GLYPH: Record<BadgeKey, React.ReactNode> = {
  workouts: <path d="M7 8v8M17 8v8M4.5 10v4M19.5 10v4M7 12h10" />,
  steps: <><path d="M8.5 4.5c1.4 0 2 1.5 2 3.3s-.8 4-2 4-2-1.8-2-3.6.6-3.7 2-3.7zM6.9 14h3.2" /><path d="M15.5 9c1.4 0 2 1.5 2 3.3s-.8 4-2 4-2-1.8-2-3.6.6-3.7 2-3.7zM13.9 18.5h3.2" /></>,
  water: <><path d="M12 4s5 5.5 5 9.2a5 5 0 0 1-10 0C7 9.5 12 4 12 4z" /><path d="M9.6 14a2.4 2.4 0 0 0 2.4 2.4" /></>,
  calories: <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="3.5" /><circle cx="12" cy="12" r=".6" fill="currentColor" /></>,
  protein: <><path d="M14.5 5.5a4.6 4.6 0 0 1 0 6.5l-3.2 3.2a3 3 0 0 1-4.3-4.3l3.2-3.2a4.6 4.6 0 0 1 4.3-2.2z" /><path d="M8.2 15.8l-2.7 2.7M5 16.5l2.5 2.5" /></>,
  fiber: <><path d="M6 18c0-7 5-12 12-12 0 7-5 12-12 12z" /><path d="M6 18l7-7" /></>,
  potassium: <path d="M13 3.5l-6 9h4.5l-1 8 6.5-9.5h-4.6z" />,
};

/**
 * A badge as a medal: a ring in the badge's color with its picture inside. Gray (with how far she's come)
 * until she earns it.
 */
export default function BadgeIcon({ badge, size = 56, earned = true, progress = 0 }: { badge: BadgeKey; size?: number; earned?: boolean; progress?: number }) {
  const b = BADGE[badge];
  const c = earned ? b.color : "#5b5b5b";
  const r = 21, len = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={`${b.name}${earned ? "" : " (not earned yet)"}`} className="shrink-0">
      <circle cx="24" cy="24" r="23" fill={earned ? `color-mix(in srgb, ${b.color} 18%, #111)` : "#161616"} />
      <circle cx="24" cy="24" r={r} fill="none" stroke={earned ? b.color : "#2a2a2a"} strokeWidth="2.5" />
      {!earned && progress > 0 && (
        <circle cx="24" cy="24" r={r} fill="none" stroke={b.color} strokeWidth="2.5" strokeLinecap="round" opacity="0.8"
          strokeDasharray={`${Math.min(1, progress) * len} ${len}`} transform="rotate(-90 24 24)" />
      )}
      <g transform="translate(12 12)" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{GLYPH[badge]}</g>
    </svg>
  );
}

/** Her earned badges as small medals, next to her name (Community posts and comments). */
export function BadgeRow({ badges, size = 16 }: { badges: string[]; size?: number }) {
  const known = badges.filter((b): b is BadgeKey => b in BADGE);
  if (!known.length) return null;
  return (
    <span className="inline-flex items-center gap-0.5 align-middle" title={known.map((k) => BADGE[k].name).join(", ")}>
      {known.map((k) => <BadgeIcon key={k} badge={k} size={size} />)}
    </span>
  );
}
