"use client";
import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { IconCircles, IconClients, IconCommunity, IconFood, IconLessons, IconToday, IconWorkouts, IconProgress } from "./Icons";

// Order set by Michael (October 28). Workouts took FAQ's place in the bar (October 28); FAQ lives in the top bar now.
const CLIENT = [
  { href: "/today", label: "Today", Icon: IconToday },
  { href: "/circles", label: "Circles", Icon: IconCircles },
  { href: "/food", label: "Food", Icon: IconFood },
  { href: "/workouts", label: "Workouts", Icon: IconWorkouts },
  { href: "/progress", label: "Progress", Icon: IconProgress },
  { href: "/community", label: "Community", Icon: IconCommunity },
  { href: "/lessons", label: "Lessons", Icon: IconLessons },
];
const COACH = [
  { href: "/coach", label: "Clients", Icon: IconClients },
  { href: "/today", label: "Today", Icon: IconToday },
  { href: "/workouts", label: "Workouts", Icon: IconWorkouts },
  { href: "/lessons", label: "Lessons", Icon: IconLessons },
  { href: "/community", label: "Community", Icon: IconCommunity },
];

export default function BottomNav({ coach = false }: { coach?: boolean }) {
  const path = usePathname();
  // Count screens she has opened in this session, so Back knows there's somewhere in the app to go back to.
  useEffect(() => {
    try { sessionStorage.setItem("dwtp:screens", String(Number(sessionStorage.getItem("dwtp:screens") ?? 0) + 1)); } catch {}
  }, [path]);
  const tabs = coach ? COACH : CLIENT;
  const active = tabs.filter((t) => path.startsWith(t.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map(({ href, label, Icon }) => (
          <li key={href}>
            <Link href={href} aria-current={active === href ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${active === href ? "text-accent" : "text-dim"}`}>
              <Icon />{label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
