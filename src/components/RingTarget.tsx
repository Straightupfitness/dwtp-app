/** Concentric rings: ring 1 in the center, each in its own color. Rings to come show as a faint tint. */
export default function RingTarget({ rings, size = 176, label }: {
  rings: { color: string; fraction: number }[]; size?: number; label: string;
}) {
  const n = rings.length;
  const step = n > 1 ? 108 / (n - 1) : 0;
  const sw = Math.max(3, Math.min(9, n > 1 ? step * 0.62 : 10));
  return (
    <svg width={size} height={size} viewBox="0 0 280 280" role="img" aria-label={label} className="shrink-0">
      <g fill="none" strokeWidth={sw} transform="rotate(-90 140 140)">
        {rings.map((r, i) => {
          const radius = 22 + i * step;
          const c = 2 * Math.PI * radius;
          return (
            <g key={i}>
              <circle cx="140" cy="140" r={radius} stroke={r.color} strokeOpacity={0.18} />
              {r.fraction > 0 && (
                <circle cx="140" cy="140" r={radius} stroke={r.color}
                  strokeLinecap={r.fraction < 1 ? "round" : "butt"}
                  strokeDasharray={r.fraction >= 1 ? undefined : `${Math.max(2, c * r.fraction)} ${c}`} />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
