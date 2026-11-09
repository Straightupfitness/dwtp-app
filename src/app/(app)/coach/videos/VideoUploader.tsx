"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { codeFromFileName, type ProgramVideo } from "@/lib/videos";
import { registerVideo, removeVideo } from "./actions";

type Item = { name: string; code: string | null; status: "waiting" | "uploading" | "done" | "error" | "skipped"; note?: string };
type SetRow = { title: string; prefix: string; codes: { code: string; video: ProgramVideo | null }[] };

/** Read a video file's length and shape in the browser before uploading it. */
function meta(file: File): Promise<{ portrait: boolean | null; seconds: number | null }> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    const url = URL.createObjectURL(file);
    const done = (r: { portrait: boolean | null; seconds: number | null }) => { URL.revokeObjectURL(url); resolve(r); };
    v.preload = "metadata"; v.muted = true;
    v.onloadedmetadata = () => done({ portrait: v.videoWidth && v.videoHeight ? v.videoHeight > v.videoWidth : null, seconds: Number.isFinite(v.duration) ? Math.round(v.duration * 10) / 10 : null });
    v.onerror = () => done({ portrait: null, seconds: null });
    setTimeout(() => done({ portrait: null, seconds: null }), 8000);
    v.src = url;
  });
}

export default function VideoUploader({ sets, extra }: { sets: SetRow[]; extra: ProgramVideo[] }) {
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ProgramVideo | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const update = (i: number, s: Partial<Item>) => setItems((cur) => cur.map((x, j) => (j === i ? { ...x, ...s } : x)));

  async function upload(files: File[]) {
    const vids = files.filter((f) => /^video\//.test(f.type) || /\.(mp4|mov|m4v)$/i.test(f.name)).sort((a, b) => a.name.localeCompare(b.name));
    if (!vids.length) return;
    const list: Item[] = vids.map((f) => ({ name: f.name, code: codeFromFileName(f.name), status: "waiting" }));
    // The same code twice: keep the last one (e.g. "CHK-02.mp4" and "CHK-02 v2.mp4").
    const lastFor = new Map<string, number>();
    list.forEach((x, i) => x.code && lastFor.set(x.code, i));
    list.forEach((x, i) => { if (!x.code) { x.status = "skipped"; x.note = "No code in the name (like CHK-02)"; } else if (lastFor.get(x.code) !== i) { x.status = "skipped"; x.note = `Another file is also ${x.code}`; } });
    const offset = items.length;
    setItems((cur) => [...cur, ...list]);
    setBusy(true);
    const supabase = createClient();
    const queue = list.map((x, i) => ({ x, i, f: vids[i] })).filter((q) => q.x.status === "waiting");
    await Promise.all(Array.from({ length: 3 }, async () => {
      for (let q = queue.shift(); q; q = queue.shift()) {
        const at = offset + q.i;
        update(at, { status: "uploading" });
        const m = await meta(q.f);
        const ext = /\.mov$/i.test(q.f.name) ? "mov" : "mp4";
        const path = `${q.x.code}.${ext}`;
        const { error } = await supabase.storage.from("program-videos").upload(path, q.f, { upsert: true, contentType: q.f.type || (ext === "mov" ? "video/quicktime" : "video/mp4"), cacheControl: "31536000" });
        if (error) { update(at, { status: "error", note: /exceed|too large|413/i.test(error.message) ? "Too big for Supabase. Use the smaller copy from the app folder." : error.message }); continue; }
        const r = await registerVideo({ code: q.x.code!, path, portrait: m.portrait, seconds: m.seconds, bytes: q.f.size });
        update(at, r?.error ? { status: "error", note: r.error } : { status: "done", note: `${m.seconds ? `${Math.round(m.seconds)}s` : ""}${m.portrait === false ? " · landscape" : m.portrait ? " · portrait" : ""}` });
      }
    }));
    setBusy(false);
    router.refresh();
  }

  const done = items.filter((x) => x.status === "done").length;
  return (
    <div className="space-y-4">
      <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); upload([...e.dataTransfer.files]); }}
        className={`grid place-items-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center ${over ? "border-accent bg-[#1f1708]" : "border-[#333] bg-card"}`}>
        <p className="text-[15px]"><b>Drag your videos here</b> <span className="text-dim">(select them all in the folder and drag them in)</span></p>
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-black disabled:opacity-50">Or choose files</button>
        <input ref={input} type="file" accept="video/*,.mp4,.mov" multiple hidden onChange={(e) => { upload([...(e.target.files ?? [])]); e.target.value = ""; }} />
        <p className="text-[12px] text-dim">Use the smaller copies from the <b>app</b> folder. They load fast on phones.</p>
      </div>

      {items.length > 0 && (
        <div className="space-y-1.5 rounded-2xl border border-border bg-card p-3">
          <p className="text-sm"><b>{done}</b> of {items.filter((x) => x.status !== "skipped").length} uploaded{busy ? "…" : ""}</p>
          <ul className="max-h-72 space-y-0.5 overflow-y-auto text-[13px]">
            {items.map((x, i) => (
              <li key={i} className="flex items-baseline gap-2">
                <span className={`w-4 shrink-0 ${x.status === "done" ? "text-[#7ee2a8]" : x.status === "error" ? "text-[var(--red)]" : "text-dim"}`}>{x.status === "done" ? "✓" : x.status === "error" ? "✕" : x.status === "uploading" ? "…" : x.status === "skipped" ? "–" : "·"}</span>
                <span className="w-16 shrink-0 font-semibold">{x.code ?? "?"}</span>
                <span className="min-w-0 truncate text-dim">{x.name}{x.note ? ` · ${x.note}` : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sets.map((s) => {
        const have = s.codes.filter((c) => c.video).length;
        return (
          <div key={s.title} className="space-y-2">
            <h2 className="flex items-baseline justify-between text-sm uppercase tracking-widest text-dim">{s.title}<span className={have === s.codes.length ? "text-[#7ee2a8]" : ""}>{have}/{s.codes.length}</span></h2>
            <div className="flex flex-wrap gap-1.5">
              {s.codes.map((c) => c.video
                ? <button key={c.code} type="button" onClick={() => setPreview(c.video)} className="min-h-9 rounded-lg bg-[#14532d] px-2.5 text-[12px] font-semibold text-[#7ee2a8]">{c.code}</button>
                : <span key={c.code} className="grid min-h-9 place-items-center rounded-lg border border-[#2a2a2a] px-2.5 text-[12px] text-dim">{c.code}</span>)}
            </div>
          </div>
        );
      })}
      {extra.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm uppercase tracking-widest text-dim">Other</h2>
          <div className="flex flex-wrap gap-1.5">{extra.map((v) => <button key={v.code} type="button" onClick={() => setPreview(v)} className="min-h-9 rounded-lg bg-[#14532d] px-2.5 text-[12px] font-semibold text-[#7ee2a8]">{v.code}</button>)}</div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => setPreview(null)} role="dialog" aria-modal="true" aria-label={`Video ${preview.code}`}>
          <div className="w-full max-w-sm space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><b>{preview.code}</b><button type="button" onClick={() => setPreview(null)} className="min-h-10 px-2 text-dim">Close ✕</button></div>
            <video src={preview.url} controls autoPlay playsInline className="max-h-[75dvh] w-full rounded-xl bg-black" />
            <button type="button" onClick={async () => { await removeVideo(preview.code); setPreview(null); router.refresh(); }} className="min-h-10 text-xs text-[var(--red)]">Remove this video</button>
          </div>
        </div>
      )}
    </div>
  );
}
