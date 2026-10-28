import Link from "next/link";
import Image from "next/image";
import Avatar from "./Avatar";
import { IconCalendar, IconChat, IconFaq } from "./Icons";

/** One top-bar button: icon over a word, so every button says what it is. */
function Btn({ href, label, icon, badge, aria }: { href: string; label: string; icon: React.ReactNode; badge?: number; aria?: string }) {
  return (
    <Link href={href} aria-label={aria} className="relative flex min-h-11 min-w-[48px] flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 text-accent">
      <span className="[&_svg]:size-[20px]">{icon}</span>
      <span className="text-[10px] font-semibold leading-none text-text">{label}</span>
      {badge ? (
        <span className="absolute -top-0.5 right-0 grid min-w-[17px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold leading-[17px] text-black">{badge > 9 ? "9+" : badge}</span>
      ) : null}
    </Link>
  );
}

/** Top of every screen: the lion (home) on the left; Calendar, FAQ, Chat and her picture on the right. */
export default function TopBar({ coach, unread, name, avatarPath }: {
  coach: boolean; unread: number; name: string | null; avatarPath: string | null;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-md items-center justify-between px-3">
        <Link href={coach ? "/coach" : "/today"} aria-label="Home">
          <Image src="/brand/dwtp-logo.png" alt="DWTP" width={67} height={32} className="h-8 w-auto mix-blend-lighten" priority />
        </Link>
        <div className="flex items-center gap-0.5">
          <Btn href={coach ? "/coach/calendar" : "/calendar"} label="Calendar" icon={<IconCalendar />} />
          <Btn href="/faq" label="FAQ" icon={<IconFaq />} />
          <Btn href={coach ? "/coach/inbox" : "/chat"} label={coach ? "Inbox" : "Chat"} icon={<IconChat />} badge={unread}
            aria={unread ? `${coach ? "Inbox" : "Chat with Michael"}, ${unread} unread` : coach ? "Inbox" : "Chat with Michael"} />
          <Link href="/me" aria-label="Me" className="ml-1 grid size-11 place-items-center rounded-full">
            <Avatar name={name} path={avatarPath} size={34} coach={coach} />
          </Link>
        </div>
      </div>
    </header>
  );
}
