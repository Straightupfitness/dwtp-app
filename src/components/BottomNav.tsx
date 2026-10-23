"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const CLIENT = [
  { href: "/today", label: "Today" },
  { href: "/circles", label: "Circles" },
  { href: "/food", label: "Food" },
  { href: "/checkin", label: "Check-in" },
  { href: "/community", label: "Community" },
  { href: "/chat", label: "Chat", badge: true },
];
const COACH = [
  { href: "/coach/inbox", label: "Inbox", badge: true },
  { href: "/coach", label: "Clients" },
  { href: "/community", label: "Community" },
  { href: "/today", label: "Today" },
  { href: "/circles", label: "Circles" },
  { href: "/food", label: "Food" },
];

export default function BottomNav({ coach = false, unread = 0 }: { coach?: boolean; unread?: number }) {
  const path = usePathname();
  const tabs = coach ? COACH : CLIENT;
  // Longest matching tab wins, so /coach/inbox doesn't also light up Clients.
  const active = tabs.filter((t) => path.startsWith(t.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-md justify-between px-1">
        {tabs.map((t) => (
          <li key={t.href} className="flex-1">
            <Link href={t.href} aria-current={active === t.href ? "page" : undefined}
              className={`relative block py-3 text-center text-[11px] font-semibold uppercase ${active === t.href ? "text-accent" : "text-dim"}`}>
              {t.label}
              {t.badge && unread > 0 && (
                <span className="absolute right-1 top-1.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold leading-4 text-black"
                  aria-label={`${unread} unread`}>{unread > 9 ? "9+" : unread}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
