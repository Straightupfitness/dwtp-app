/** Thin line icons for FAQ list titles, picked from the title's words. */
const P: Record<string, React.ReactNode> = {
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  egg: <path d="M12 3c3.5 0 6.5 5.5 6.5 10a6.5 6.5 0 0 1-13 0C5.5 8.5 8.5 3 12 3z" />,
  leaf: <><path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15" /><path d="M5 19l8-8" /></>,
  drop: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  pot: <><path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" /><path d="M2 10h20M9 6c0-1 1-2 3-2s3 1 3 2" /></>,
  shield: <><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z" /><path d="M9 12l2 2 4-4" /></>,
  bolt: <path d="M13 2L5 13h6l-1 9 8-11h-6z" />,
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  flame: <path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z" />,
  heart: <path d="M12 20s-7-4.4-9-8.6A4.9 4.9 0 0 1 12 6.6a4.9 4.9 0 0 1 9 4.8C19 15.6 12 20 12 20z" />,
  bed: <><path d="M3 18V7M3 13h18v5M21 13a3 3 0 0 0-3-3h-7v3" /><circle cx="7" cy="10.5" r="1.5" /></>,
  home: <><path d="M4 11l8-7 8 7v9H4z" /><path d="M10 20v-5h4v5" /></>,
  dumbbell: <path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12" />,
  bag: <><path d="M5 8h14l-1 12H6z" /><path d="M9 8a3 3 0 0 1 6 0" /></>,
};

const RULES: [RegExp, string][] = [
  [/every ?day|daily/i, "sun"], [/protein/i, "egg"], [/carb|fruit|veg/i, "leaf"], [/fat|oil/i, "drop"],
  [/kitchen|cook/i, "pot"], [/essential|basic/i, "shield"], [/energy|focus/i, "bolt"], [/sleep|night/i, "moon"],
  [/perform|pre-?work/i, "flame"], [/mood|inflam|stress/i, "heart"], [/bed/i, "bed"], [/home|house/i, "home"],
  [/train|gym|gear/i, "dumbbell"],
];

export function ListIcon({ title, color = "currentColor" }: { title: string; color?: string }) {
  const key = RULES.find(([r]) => r.test(title))?.[1] ?? "bag";
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#3a2e18] bg-[#1a1409]" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{P[key]}</svg>
    </span>
  );
}
