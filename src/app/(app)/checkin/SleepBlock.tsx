"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage } from "@/lib/image";

export const SLEEP_HOURS = ["Under 6", "6–7", "7–7.5", "7.5+", "Not sure"];

/**
 * Sleep in the weekly check-in (October 27): roughly how many hours a night, plus up to 3 screenshots
 * from whatever she tracks sleep with. Michael (and the AI draft) reads the screenshots.
 */
export default function SleepBlock({ userId, week, hours, photos, onHours, onPhotos }: {
  userId: string; week: number; hours: string | undefined; photos: string[];
  onHours: (v: string) => void; onPhotos: (paths: string[]) => void;
}) {
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setError("");
    const added: string[] = [];
    try {
      for (const f of Array.from(files).slice(0, 3 - photos.length)) {
        const small = await shrinkImage(f, 1400, 0.85);
        const path = `${userId}/sleep-w${week}-${crypto.randomUUID()}.jpg`;
        const { error: e } = await createClient().storage.from("checkin-videos").upload(path, small, { contentType: "image/jpeg" });
        if (e) throw e;
        added.push(path);
        setPreviews((p) => ({ ...p, [path]: URL.createObjectURL(small) }));
      }
      onPhotos([...photos, ...added]);
    } catch (e) { setError(`Couldn't add that picture: ${(e as Error).message}`); }
    setBusy(false);
  }

  return (
    <div className="space-y-3 rounded-[18px] border border-border bg-card p-4">
      <div>
        <p className="text-base font-semibold">Your sleep this week</p>
        <p className="text-[13px] text-[#a8a8a8]">About how many hours a night?</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {SLEEP_HOURS.map((o) => (
          <button key={o} type="button" onClick={() => onHours(o)} aria-pressed={hours === o}
            className={`min-h-11 rounded-xl px-3.5 text-sm ${hours === o ? "bg-accent font-semibold text-black" : "border border-[#2a2a2a]"}`}>{o === "Not sure" ? o : `${o} hrs`}</button>
        ))}
      </div>
      <div className="space-y-2 border-t border-border pt-3">
        <p className="text-[14px]">Track your sleep? Add a screenshot <span className="text-dim">(optional)</span></p>
        <p className="text-xs text-dim">Your weekly sleep from Apple Health, your watch, Oura, Fitbit, Whoop… whatever you use.</p>
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {photos.map((p) => (
              <div key={p} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview of her screenshot */}
                {previews[p] ? <img src={previews[p]} alt="Your sleep screenshot" className="h-24 w-16 rounded-lg object-cover" /> : <div className="grid h-24 w-16 place-items-center rounded-lg bg-[#1e1e1e] text-xs text-dim">Added</div>}
                <button type="button" onClick={() => onPhotos(photos.filter((x) => x !== p))} aria-label="Remove screenshot"
                  className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-[#2a2a2a] text-xs">✕</button>
              </div>
            ))}
          </div>
        )}
        {photos.length < 3 && (
          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-[#2a2a2a] px-4 text-sm font-semibold">
            {busy ? "Adding…" : photos.length ? "Add another" : "Add a screenshot"}
            <input type="file" accept="image/*" multiple className="hidden" disabled={busy} onChange={(e) => add(e.target.files)} />
          </label>
        )}
        {error && <p className="text-xs text-[var(--red)]">{error}</p>}
      </div>
    </div>
  );
}
