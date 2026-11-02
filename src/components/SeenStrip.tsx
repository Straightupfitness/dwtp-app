import type { SeenWeek } from "@/lib/seen";

const wd = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "narrow", timeZone: "UTC" });
const full = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** "Last in the app" and her last 7 days (November 1): ✓ green = opened the app that day, ✗ red = didn't. */
export default function SeenStrip({ seen, size = 16, labels = false, today, what = "in the app" }: { seen: SeenWeek | null; size?: number; labels?: boolean; today?: string; what?: string }) {
  if (!seen) return null;
  return (
    <span className="inline-flex items-end gap-[3px]" aria-label={`${what}: ${seen.days.map((d) => `${full(d.date)} ${d.seen ? "yes" : d.seen === false ? "no" : "unknown"}`).join(", ")}`}>
      {seen.days.map((x) => ({ ...x, seen: x.seen === false && x.date === seen.days[seen.days.length - 1].date ? null : x.seen })).map((d) => (
        <span key={d.date} className="flex flex-col items-center gap-0.5" title={`${full(d.date)}: ${d.seen ? what : d.seen === false ? `not ${what}` : d.date === seen.days[seen.days.length - 1].date ? "not yet today" : "before tracking started"}`}>
          <span className={`grid place-items-center rounded-[4px] font-bold leading-none ${d.seen ? "bg-[#14532d] text-[#7ee2a8]" : d.seen === false ? "bg-[#3b1219] text-[#fb7185]" : "bg-[#1f1f1f] text-[#555]"} ${d.date === (today ?? seen.days[seen.days.length - 1].date) ? "ring-1 ring-[#666]" : ""}`}
            style={{ width: size, height: size, fontSize: size * 0.68 }} aria-hidden="true">{d.seen ? "✓" : d.seen === false ? "✕" : "·"}</span>
          {labels && <span className="text-[9px] text-dim">{wd(d.date)}</span>}
        </span>
      ))}
    </span>
  );
}

export function lastInLabel(seen: SeenWeek | null) {
  if (!seen?.lastDate) return "Never";
  const today = seen.days[seen.days.length - 1].date;
  if (seen.lastDate === today) return "Today";
  const days = Math.round((Date.parse(today) - Date.parse(seen.lastDate)) / 86_400_000);
  if (days === 1) return "Yesterday";
  return `${full(seen.lastDate)}${days > 1 ? ` (${days}d)` : ""}`;
}
