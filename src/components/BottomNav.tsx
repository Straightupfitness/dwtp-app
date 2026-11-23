"use client";
import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { IconClients, IconKpis, IconLeads, IconCommunity, IconFood, IconLessons, IconToday, IconWorkouts, IconCalendar } from "./Icons";

// Order set by Michael (October 28); Circles moved into Progress (October 29). Workouts took FAQ's place in the bar (October 28); FAQ lives in the top bar now.
const CLIENT = [
  // November 23: Progress folded into Today, Lessons into the Calendar, Calendar moved down from the top bar.
  { href: "/today", label: "Today", Icon: IconToday },
  { href: "/calendar", label: "Calendar", Icon: IconCalendar },
  { href: "/food", label: "Food", Icon: IconFood },
  { href: "/workouts", label: "Workouts", Icon: IconWorkouts },
  { href: "/community", label: "Community", Icon: IconCommunity },
];
const COACH = [
  { href: "/coach/kpis", label: "KPIs", Icon: IconKpis }, // November 17: left of Leads
  { href: "/coach/leads", label: "Leads", Icon: IconLeads }, // November 15: left of Clients
  { href: "/coach", label: "Clients", Icon: IconClients },
  // November 7: no Today tab for Michael. Today is her screen; he lands on Clients (use "See her app" to see hers).
  { href: "/coach/workouts", label: "Workouts", Icon: IconWorkouts }, // November 19: his whole library, not one client's week
  { href: "/coach/program", label: "Program", Icon: IconLessons }, // November 19: the flow chart, every lesson and every circle
  { href: "/community", label: "Community", Icon: IconCommunity },
];

export default function BottomNav({ coach = false }: { coach?: boolean }) {
  const path = usePathname();
  // Count screens she has opened in this session, so Back knows there's somewhere in the app to go back to.
  useEffect(() => {
    try { sessionStorage.setItem("dwtp:screens", String(Number(sessionStorage.getItem("dwtp:screens") ?? 0) + 1)); } catch {}
  }, [path]);
  // November 17 (Claudia): on iPhone, after a date or day picker (or the keyboard) closes, the bar at the bottom
  // could stay stuck halfway up the screen over her meals. Nudging the scroll after it closes puts it back.
  useEffect(() => {
    const fix = () => setTimeout(() => window.scrollTo(window.scrollX, window.scrollY), 60);
    const vv = window.visualViewport;
    document.addEventListener("focusout", fix);
    document.addEventListener("change", fix);
    vv?.addEventListener("resize", fix);
    return () => { document.removeEventListener("focusout", fix); document.removeEventListener("change", fix); vv?.removeEventListener("resize", fix); };
  }, []);
  const tabs = coach ? COACH : CLIENT;
  // Circles and progress live on Today now (November 23); lessons live in the Calendar.
  const here = coach ? path : path.startsWith("/circles") || path.startsWith("/progress") ? "/today" : path.startsWith("/lessons") ? "/calendar" : path;
  const active = tabs.filter((t) => here.startsWith(t.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className={`mx-auto grid ${coach ? "max-w-md md:max-w-2xl" : "max-w-md"}`} style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
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
