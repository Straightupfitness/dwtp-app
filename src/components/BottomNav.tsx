"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/today", label: "Today" },
  { href: "/circles", label: "Circles" },
  { href: "/food", label: "Food" },
  { href: "/community", label: "Community" },
  { href: "/me", label: "Me" },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-md justify-between px-2">
        {TABS.map((t) => {
          const active = path.startsWith(t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link href={t.href} aria-current={active ? "page" : undefined}
                className={`block py-3 text-center text-xs font-semibold uppercase tracking-wide ${active ? "text-accent" : "text-dim"}`}>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
