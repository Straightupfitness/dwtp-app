"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AvatarPicker from "@/app/(app)/me/AvatarPicker";
import { markHomeScreen } from "@/app/(app)/me/actions";
import NotificationSettings from "./NotificationSettings";

const Check = ({ on, n }: { on: boolean; n: number }) => (
  <span className={`grid size-7 shrink-0 place-items-center rounded-full border-2 text-[13px] font-bold ${on ? "border-[#7ee2a8] bg-[#7ee2a8] text-black" : "border-[var(--red)] text-[var(--red)]"}`}>
    {on ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg> : n}
  </span>
);

/** Her first two steps, on Today until both are done: the Home Screen, then a profile picture. */
export default function DoThisFirst({ userId, name, homeDone, avatarPath }: { userId: string; name: string | null; homeDone: boolean; avatarPath: string | null }) {
  const router = useRouter();
  const [home, setHome] = useState(homeDone);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(true);

  useEffect(() => {
    const sa = window.matchMedia("(display-mode: standalone)").matches || !!(navigator as { standalone?: boolean }).standalone;
    setStandalone(sa); // eslint-disable-line react-hooks/set-state-in-effect -- read once from the browser
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    // Opened from the Home Screen: step 1 checks itself off.
    if (sa && !homeDone) { setHome(true); markHomeScreen().then(() => router.refresh()); }
  }, [homeDone, router]);

  const photo = !!avatarPath;
  if (home && photo) return null;
  return (
    <div className="space-y-3 rounded-2xl border-2 border-[var(--red)] bg-[#1c0c0b] p-4">
      <p className="font-[family-name:var(--font-display)] text-xl uppercase text-[#ff8a7e]">Do this first</p>

      <div className="flex gap-3">
        <Check on={home} n={1} />
        <div className="flex-1 space-y-1.5">
          <p className={`text-[15px] font-semibold ${home ? "text-[#a8a8a8] line-through" : ""}`}>Add this app to your Home Screen</p>
          {!home && <>
            <p className="text-[13px] leading-relaxed text-[#d0b4b0]">That&apos;s how you get notified when Michael replies.{" "}
              {ios ? <>In Safari, tap <b className="text-text">Share</b>, then <b className="text-text">Add to Home Screen</b>. Then open DWTP from your Home Screen.</>
                : <>Tap the <b className="text-text">⋮</b> menu, then <b className="text-text">Add to Home screen</b>. Then open DWTP from your Home Screen.</>}
            </p>
            <button type="button" onClick={async () => { setHome(true); await markHomeScreen(); router.refresh(); }}
              className="min-h-10 rounded-lg border border-[#5a2a25] px-3 text-[13px] font-semibold text-[#ff8a7e]">I&apos;ve done this</button>
          </>}
          {home && standalone && <NotificationSettings compact />}
        </div>
      </div>

      <div className="flex gap-3">
        <Check on={photo} n={2} />
        <div className="flex-1 space-y-2">
          <p className={`text-[15px] font-semibold ${photo ? "text-[#a8a8a8] line-through" : ""}`}>Add a profile picture</p>
          {!photo && <>
            <p className="text-[13px] leading-relaxed text-[#d0b4b0]">So Michael and the other women in the community can see who you are.</p>
            <AvatarPicker userId={userId} name={name} path={avatarPath} />
          </>}
        </div>
      </div>
    </div>
  );
}
