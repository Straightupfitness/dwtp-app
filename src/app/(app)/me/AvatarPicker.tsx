"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage } from "@/lib/image";
import Avatar from "@/components/Avatar";
import { setAvatar } from "./actions";

export default function AvatarPicker({ userId, name, path }: { userId: string; name: string | null; path: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function pick(f?: File) {
    if (!f) return;
    setBusy(true); setError("");
    try {
      const small = await shrinkImage(f, 512, 0.85);
      const p = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error: e } = await createClient().storage.from("avatars").upload(p, small, { contentType: "image/jpeg", cacheControl: "31536000" });
      if (e) throw e;
      await setAvatar(p);
    } catch (e) { setError(`Couldn't save your photo: ${(e as Error).message}`); }
    setBusy(false);
  }
  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} path={path} size={84} />
      <div className="space-y-1">
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-border px-4 text-sm font-semibold">
          {busy ? "Saving…" : path ? "Change photo" : "Add a profile photo"}
          <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {path && !busy && <button type="button" onClick={() => setAvatar(null)} className="block text-xs text-dim underline">Remove photo</button>}
        {error && <p className="text-xs text-[var(--red)]">{error}</p>}
      </div>
    </div>
  );
}
