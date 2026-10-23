"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/today", label: "Today" },
  { href: "/circles", label: "Circles" },
  { href: "/food", label: "Food" },
  { href: "/checkin", label: "Check-in" },
  { href: "/community", label: "Community" },
  { href: "/me", label: "Me" },
];

export default function BottomNav({ coach = false }: { coach?: boolean }) {
  const path = usePathname();
  const tabs = coach ? [{ href: "/coach", label: "Coach" }, ...TABS.filter((t) => t.href !== "/me")] : TABS;
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-md justify-between px-1">
        {tabs.map((t) => {
          const active = path.startsWith(t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link href={t.href} aria-current={active ? "page" : undefined}
                className={`block py-3 text-center text-[11px] font-semibold uppercase ${active ? "text-accent" : "text-dim"}`}>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
