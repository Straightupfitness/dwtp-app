import Link from "next/link";
import Image from "next/image";
import Avatar from "./Avatar";
import { IconCalendar, IconChat, IconFaq } from "./Icons";

/** One top-bar button: icon over a word, so every button says what it is. */
function Btn({ href, label, icon, badge, aria }: { href: string; label: string; icon: React.ReactNode; badge?: number; aria?: string }) {
  return (
    <Link href={href} aria-label={aria} className="relative flex min-h-11 min-w-[48px] flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 text-accent">
      <span className="grid h-[22px] place-items-center [&>svg]:size-[20px]">{icon}</span>
      <span className="text-[10px] font-semibold leading-none text-text">{label}</span>
      {badge ? (
        <span className="absolute -top-0.5 right-0 grid min-w-[17px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold leading-[17px] text-black">{badge > 9 ? "9+" : badge}</span>
      ) : null}
    </Link>
  );
}

/** Top of every screen: the lion (home) on the left; Calendar, FAQ, Chat and Account (her picture) on the right. */
export default function TopBar({ coach, unread, alerts = 0, name, avatarPath }: {
  coach: boolean; unread: number; alerts?: number; name: string | null; avatarPath: string | null;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className={`mx-auto flex h-14 items-center justify-between px-3 ${coach ? "max-w-md md:max-w-[1400px] md:px-8" : "max-w-md"}`}>
        <Link href={coach ? "/coach" : "/today"} aria-label="Home">
          <Image src="/brand/dwtp-logo.png" alt="DWTP" width={67} height={32} className="h-8 w-auto mix-blend-lighten" priority />
        </Link>
        <div className="flex items-center gap-0.5">
          <Btn href={coach ? "/coach/calendar" : "/calendar"} label="Calendar" icon={<IconCalendar />} />
          {/* November 11: her notifications, so the number on the app icon means something. */}
          <Btn href="/notifications" label="Alerts" icon={<Bell />} badge={alerts} aria={alerts ? `Notifications, ${alerts} new` : "Notifications"} />
          <Btn href="/faq" label="FAQ" icon={<IconFaq />} />
          <Btn href={coach ? "/coach/inbox" : "/chat"} label={coach ? "Inbox" : "Chat"} icon={<IconChat />} badge={unread}
            aria={unread ? `${coach ? "Inbox" : "Chat with Michael"}, ${unread} unread` : coach ? "Inbox" : "Chat with Michael"} />
          <Btn href="/me" label="Account" icon={<Avatar name={name} path={avatarPath} size={22} coach={coach} />} />
        </div>
      </div>
    </header>
  );
}

function Bell() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" /><path d="M10 20a2.2 2.2 0 0 0 4 0" /></svg>;
}
