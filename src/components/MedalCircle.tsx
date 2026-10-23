/**
 * A Capacity Circle: one medal per step, set around a circle like the hours on a clock, medal 1 at 12 o'clock.
 * Each medal fills from the bottom up like a glass; a finished medal is solid with a check.
 * Medals to come are a faint outline. All medals in a circle share the circle's color.
 */
export default function MedalCircle({ medals, color, size = 100, detail = false, center, label }: {
  medals: number[];          // 0–1 per medal
  color: string;
  size?: number;
  detail?: boolean;          // numbers and checks on the medals (big drawing)
  center?: string;           // e.g. "2/10"
  label: string;
}) {
  const n = Math.max(1, medals.length);
  const c = size / 2;
  const mr = size * (n <= 7 ? 0.1 : n <= 10 ? 0.085 : n <= 12 ? 0.072 : 0.058);
  const R = c - mr - size * 0.02;
  const stroke = Math.max(1, size * 0.01);
  const id = `m${Math.round(size)}${n}${color.slice(1)}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="shrink-0">
      {medals.map((f, i) => {
        const a = (-90 + (i * 360) / n) * (Math.PI / 180);
        const x = c + R * Math.cos(a), y = c + R * Math.sin(a);
        const h = 2 * mr * Math.min(1, f);
        const s = mr * 0.5;
        return (
          <g key={i}>
            <clipPath id={`${id}-${i}`}><circle cx={x} cy={y} r={mr} /></clipPath>
            <circle cx={x} cy={y} r={mr} fill={color} fillOpacity={0.14} stroke={color} strokeOpacity={f > 0 ? 1 : 0.35} strokeWidth={stroke} />
            {f > 0 && <rect clipPath={`url(#${id}-${i})`} x={x - mr} y={y + mr - h} width={2 * mr} height={h} fill={color} />}
            {detail && (f >= 1
              ? <path d={`M${x - s * 0.8} ${y} l${s * 0.55} ${s * 0.55} l${s * 1.05} ${-s * 1.1}`} fill="none" stroke="#0a0a0a"
                  strokeWidth={mr * 0.22} strokeLinecap="round" strokeLinejoin="round" />
              : <text x={x} y={y + mr * 0.36} textAnchor="middle" fontFamily="Oswald, 'Arial Narrow', sans-serif" fontSize={mr}
                  fill={f >= 0.6 ? "#0a0a0a" : "#f5f5f5"} fillOpacity={f > 0 ? 1 : 0.55}>{i + 1}</text>)}
          </g>
        );
      })}
      {center && (
        <text x={c} y={c + size * 0.07} textAnchor="middle" fontFamily="Oswald, 'Arial Narrow', sans-serif" fontWeight={600}
          fontSize={size * 0.2} fill="#f5f5f5">{center}</text>
      )}
    </svg>
  );
}
