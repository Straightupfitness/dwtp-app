"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Pick the "DWTP Exercise Clips" folder once: every <id>.mp4 and <id>.jpg goes to exercise-clips/sltp/. */
export default function Uploader() {
  const [files, setFiles] = useState<File[]>([]);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  async function upload() {
    setRunning(true); setDone(0); setFailed([]); setFinished(false);
    const sb = createClient();
    const queue = [...files];
    const worker = async () => {
      for (let f = queue.shift(); f; f = queue.shift()) {
        const { error } = await sb.storage.from("exercise-clips").upload(`sltp/${f.name}`, f, {
          upsert: true, contentType: f.name.endsWith(".mp4") ? "video/mp4" : "image/jpeg", cacheControl: "31536000",
        });
        if (error) setFailed((x) => [...x, `${f.name}: ${error.message}`]);
        setDone((n) => n + 1);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    setRunning(false); setFinished(true);
  }

  const mb = Math.round(files.reduce((n, f) => n + f.size, 0) / 1e6);
  const pct = files.length ? Math.round((done / files.length) * 100) : 0;
  return (
    <div className="space-y-3">
      <label className="flex min-h-[110px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[16px] border-2 border-dashed border-[#3a3a3a] bg-card p-4 text-center">
        <span className="text-[15px] font-semibold">Choose the &ldquo;DWTP Exercise Clips&rdquo; folder</span>
        <span className="text-[13px] text-dim">In Downloads. Pick the folder itself.</span>
        <input type="file" multiple className="hidden" disabled={running}
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          onChange={(e) => { setFiles([...(e.target.files ?? [])].filter((f) => /^\d+\.(mp4|jpg)$/.test(f.name))); setDone(0); setFinished(false); setFailed([]); }} />
      </label>
      {files.length > 0 && (
        <div className="space-y-2.5 rounded-[16px] border border-border bg-card p-3.5">
          <p className="text-[14px]">{files.filter((f) => f.name.endsWith(".mp4")).length} clips and {files.filter((f) => f.name.endsWith(".jpg")).length} pictures · {mb} MB</p>
          <div className="h-2 rounded-full bg-[#262626]"><div className="h-2 rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} /></div>
          <p className="text-[13px] text-dim">{running ? `Uploading… ${done} of ${files.length}. Keep this page open.` : finished ? `Done: ${done - failed.length} uploaded${failed.length ? `, ${failed.length} failed` : ""}.` : "Ready."}</p>
          {!running && !finished && <button type="button" onClick={upload} className="min-h-12 w-full rounded-[12px] bg-accent font-semibold text-black">Upload all</button>}
          {failed.length > 0 && <ul className="max-h-40 overflow-y-auto text-[12px] text-[var(--red)]">{failed.map((f) => <li key={f}>{f}</li>)}</ul>}
          {finished && failed.length > 0 && <button type="button" onClick={upload} className="min-h-11 w-full rounded-[12px] border border-border">Try again</button>}
        </div>
      )}
    </div>
  );
}
