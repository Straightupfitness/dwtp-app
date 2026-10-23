/**
 * The circle drawing: one slice per ring (10 rings = 10 slices of 36°), ring 1 starting at 12 o'clock.
 * Each slice fills from the center outward as the ring progresses; a finished ring is a full slice.
 * Rings to come show as a faint tint of their color. Half the rings done = half a circle.
 */
export function wedgePaths(rings: { color: string; fraction: number }[], size: number, gapDeg: number) {
  const c = size / 2, R = size / 2 - 1, n = rings.length, th = 360 / n;
  const pt = (deg: number, r: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(c + r * Math.cos(a)).toFixed(2)} ${(c + r * Math.sin(a)).toFixed(2)}`;
  };
  const slice = (i: number, r: number) => {
    const a0 = -90 + i * th + gapDeg / 2, a1 = -90 + (i + 1) * th - gapDeg / 2;
    return n === 1
      ? `M${c} ${c - r} A${r} ${r} 0 1 1 ${c - 0.01} ${c - r} Z`
      : `M${c} ${c} L${pt(a0, r)} A${r.toFixed(2)} ${r.toFixed(2)} 0 ${th > 180 ? 1 : 0} 1 ${pt(a1, r)} Z`;
  };
  return rings.map((ring, i) => ({
    key: i, color: ring.color,
    track: slice(i, R),
    fill: ring.fraction > 0 ? slice(i, R * Math.min(1, ring.fraction)) : null,
  }));
}

export default function RingTarget({ rings, size = 176, label, gap = 3 }: {
  rings: { color: string; fraction: number }[]; size?: number; label: string; gap?: number;
}) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="shrink-0">
      {wedgePaths(rings, size, gap).map((w) => (
        <g key={w.key}>
          <path d={w.track} fill={w.color} fillOpacity={0.16} />
          {w.fill && <path d={w.fill} fill={w.color} />}
        </g>
      ))}
    </svg>
  );
}
