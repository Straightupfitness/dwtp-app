import Link from "next/link";
import Image from "next/image";
import Avatar from "./Avatar";
import { IconChat } from "./Icons";

/** Top of every screen: the lion on the left, Chat (with unread badge) and her picture on the right. */
export default function TopBar({ coach, unread, name, avatarPath }: { coach: boolean; unread: number; name: string | null; avatarPath: string | null }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
        <Link href={coach ? "/coach" : "/today"} aria-label="Home">
          <Image src="/brand/dwtp-logo.png" alt="DWTP" width={67} height={32} className="h-8 w-auto mix-blend-lighten" priority />
        </Link>
        <div className="flex items-center gap-2">
          <Link href={coach ? "/coach/inbox" : "/chat"} aria-label={unread ? `Messages, ${unread} unread` : "Messages"}
            className="relative grid size-11 place-items-center rounded-full text-text">
            <IconChat />
            {unread > 0 && (
              <span className="absolute right-1 top-1 grid min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold leading-[18px] text-black">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          <Link href="/me" aria-label="Me" className="grid size-11 place-items-center rounded-full">
            <Avatar name={name} path={avatarPath} size={34} coach={coach} />
          </Link>
        </div>
      </div>
    </header>
  );
}
