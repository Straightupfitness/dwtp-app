"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage } from "@/lib/image";
import { photoTakenAt } from "@/lib/exif";
import { addProgressPhoto, deleteProgressPhoto } from "@/app/(app)/progress/actions";
import type { ProgressPhoto } from "@/lib/progress-photos";

const POSES = [["front", "Front"], ["side", "Side"], ["back", "Back"], ["other", "Other"]] as const;
const nice = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/**
 * November 11: progress photos. She picks the day (it fills in from the photo when it can) and front, side or back.
 * Her first and newest photo of the same pose sit side by side, with every day underneath.
 * `readOnly`: Michael's view of them on her page.
 */
export default function ProgressPhotos({ photos, userId, today, readOnly = false }: { photos: ProgressPhoto[]; userId?: string; today: string; readOnly?: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [file, setFile] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [day, setDay] = useState(today);
  const [pose, setPose] = useState<string>("front");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [big, setBig] = useState<ProgressPhoto | null>(null);
  const [sure, setSure] = useState<string | null>(null);
  const [comparePose, setComparePose] = useState<string>("front");

  const poses = useMemo(() => POSES.filter(([p]) => photos.filter((x) => x.pose === p).length >= 2), [photos]);
  const cp = poses.some(([p]) => p === comparePose) ? comparePose : poses[0]?.[0];
  const pair = cp ? [photos.filter((x) => x.pose === cp)[0], photos.filter((x) => x.pose === cp).at(-1)!] : null;
  const byDay = useMemo(() => {
    const m = new Map<string, ProgressPhoto[]>();
    for (const p of [...photos].reverse()) m.set(p.takenOn, [...(m.get(p.takenOn) ?? []), p]);
    return [...m.entries()];
  }, [photos]);

  async function pick(f?: File) {
    if (!f) return;
    setErr("");
    const taken = await photoTakenAt(f).catch(() => null);
    if (taken && !isNaN(taken.getTime())) {
      const d = new Date(taken.getTime() - taken.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
      if (d <= today) setDay(d);
    }
    const small = await shrinkImage(f, 1600, 0.85);
    setFile(small); setPreview(URL.createObjectURL(small));
  }
  async function save() {
    if (!file || !userId) return;
    setBusy(true); setErr("");
    const sb = createClient();
    const path = `${userId}/${crypto.randomUUID()}.jpg`;
    let ok = false;
    for (let i = 0; i < 3 && !ok; i++) {
      try { await fetch("/api/auth/keepalive", { cache: "no-store" }); const { error } = await sb.storage.from("progress-photos").upload(path, file, { contentType: "image/jpeg", upsert: true }); ok = !error; } catch {}
      if (!ok) await new Promise((r) => setTimeout(r, 700 * (i + 1)));
    }
    if (!ok) { setBusy(false); setErr("The photo didn't upload. Check your connection and try again."); return; }
    const r = await addProgressPhoto(path, day, pose);
    setBusy(false);
    if (r?.error) { setErr(r.error); return; }
    setAdding(false); setFile(null); setPreview(null); setDay(today);
    router.refresh();
  }

  return (
    <div id="photos" className="scroll-mt-20 space-y-3 rounded-[18px] border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Before &amp; after</p>
          <p className="font-[family-name:var(--font-display)] text-[22px] uppercase leading-tight">Progress photos</p>
        </div>
        {!readOnly && !adding && <button type="button" onClick={() => setAdding(true)} className="min-h-11 rounded-xl bg-accent px-3.5 text-[14px] font-semibold text-black">+ Add photo</button>}
      </div>

      {adding && (
        <div className="space-y-2.5 rounded-xl border border-border bg-bg p-3">
          {preview
            // eslint-disable-next-line @next/next/no-img-element -- local preview
            ? <img src={preview} alt="Your photo" className="max-h-72 w-full rounded-xl object-contain" />
            : <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-accent text-center">
                <span className="text-[15px] font-semibold text-accent">Take or pick a photo</span>
                <span className="text-[12px] text-dim">Same spot, same light, same clothes each time works best.</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
              </label>}
          <label className="flex items-center gap-2 text-[14px]">
            <span className="w-14 text-[#a8a8a8]">Day</span>
            <input type="date" max={today} value={day} onChange={(e) => e.target.value && setDay(e.target.value)}
              className="min-h-11 flex-1 rounded-lg border border-[#2a2a2a] bg-card px-2 text-[15px] outline-none [color-scheme:dark] focus:border-accent" />
          </label>
          <div className="flex items-center gap-1.5">
            <span className="w-14 text-[14px] text-[#a8a8a8]">View</span>
            {POSES.map(([v, l]) => (
              <button key={v} type="button" onClick={() => setPose(v)} aria-pressed={pose === v}
                className={`min-h-10 flex-1 rounded-lg border text-[13px] ${pose === v ? "border-accent bg-accent font-semibold text-black" : "border-[#2a2a2a]"}`}>{l}</button>
            ))}
          </div>
          {err && <p className="text-sm text-[var(--red)]">{err}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setAdding(false); setFile(null); setPreview(null); setErr(""); }} className="min-h-11 flex-1 rounded-xl border border-border text-[14px]">Cancel</button>
            <button type="button" disabled={!file || busy} onClick={save} className="min-h-11 flex-1 rounded-xl bg-accent text-[14px] font-semibold text-black disabled:opacity-40">{busy ? "Saving…" : "Save photo"}</button>
          </div>
          <p className="text-[11px] text-dim">Only you and Michael can see your photos.</p>
        </div>
      )}

      {pair && pair[0].id !== pair[1].id && (
        <div className="space-y-2">
          {poses.length > 1 && (
            <div className="flex gap-1.5">
              {poses.map(([v, l]) => <button key={v} type="button" onClick={() => setComparePose(v)} className={`min-h-9 rounded-full border px-3 text-[13px] ${cp === v ? "border-accent text-accent" : "border-[#2a2a2a] text-dim"}`}>{l}</button>)}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {pair.map((p, i) => (
              <button key={p.id} type="button" onClick={() => setBig(p)} className="space-y-1 text-left">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
                <img src={p.url} alt={`${i ? "Newest" : "First"} ${p.pose} photo, ${nice(p.takenOn)}`} className="aspect-[3/4] w-full rounded-xl bg-black object-cover" />
                <span className="block text-[12px] font-semibold">{i ? "Now" : "Before"}</span>
                <span className="block text-[11px] text-dim">{nice(p.takenOn)}</span>
              </button>
            ))}
          </div>
          <p className="text-center text-[12px] text-dim">{daysBetween(pair[0].takenOn, pair[1].takenOn)} days apart</p>
        </div>
      )}

      {byDay.length > 0 ? (
        <div className="space-y-2.5">
          {byDay.map(([d, ps]) => (
            <div key={d} className="space-y-1">
              <p className="text-[12px] text-dim">{nice(d)}</p>
              <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
                {ps.map((p) => (
                  <div key={p.id} className="relative shrink-0">
                    <button type="button" onClick={() => setBig(p)} aria-label={`Open ${p.pose} photo from ${nice(d)}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
                      <img src={p.url} alt="" className="h-28 w-[84px] rounded-lg bg-black object-cover" />
                    </button>
                    <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px] capitalize text-white">{p.pose}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : !adding && (
        <p className="text-[13px] text-dim">{readOnly ? "No progress photos yet." : "Take your “before” photos now: front, side and back. In a few weeks you'll be so glad you did."}</p>
      )}

      {big && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/95 p-4" role="dialog" aria-modal="true" onClick={() => { setBig(null); setSure(null); }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
          <img src={big.url} alt="" className="max-h-[78dvh] max-w-full rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
          <p className="text-[13px] capitalize text-[#cfcfcf]">{big.pose} · {nice(big.takenOn)}</p>
          <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
            {!readOnly && (sure === big.id
              ? <button type="button" onClick={async () => { await deleteProgressPhoto(big.id); setBig(null); setSure(null); router.refresh(); }} className="min-h-11 px-3 text-[14px] font-semibold text-[var(--red)]">Yes, delete it</button>
              : <button type="button" onClick={() => setSure(big.id)} className="min-h-11 px-3 text-[14px] text-[var(--red)]">Delete</button>)}
            <button type="button" onClick={() => { setBig(null); setSure(null); }} className="min-h-11 px-3 text-[14px] text-[#cfcfcf]">Close ✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
