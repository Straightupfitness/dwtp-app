"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCircles, IconClients, IconCommunity, IconFaq, IconFood, IconLessons, IconToday } from "./Icons";

const CLIENT = [
  { href: "/today", label: "Today", Icon: IconToday },
  { href: "/circles", label: "Circles", Icon: IconCircles },
  { href: "/lessons", label: "Lessons", Icon: IconLessons },
  { href: "/food", label: "Food", Icon: IconFood },
  { href: "/community", label: "Community", Icon: IconCommunity },
  { href: "/faq", label: "FAQ", Icon: IconFaq },
];
const COACH = [
  { href: "/coach", label: "Clients", Icon: IconClients },
  { href: "/today", label: "Today", Icon: IconToday },
  { href: "/lessons", label: "Lessons", Icon: IconLessons },
  { href: "/community", label: "Community", Icon: IconCommunity },
  { href: "/faq", label: "FAQ", Icon: IconFaq },
];

export default function BottomNav({ coach = false }: { coach?: boolean }) {
  const path = usePathname();
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
