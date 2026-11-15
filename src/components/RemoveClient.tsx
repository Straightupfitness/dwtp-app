"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteClientForever, removeClient, restoreClient } from "@/app/(app)/coach/clients/[id]/actions";

/** November 15: remove a client (reversible), restore her, or delete her for good. Bottom of her page. */
export default function RemoveClient({ clientId, first, removed }: { clientId: string; first: string; removed: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ask, setAsk] = useState<"" | "remove" | "delete">("");
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState("");
  const run = (f: () => Promise<{ error?: string; ok?: boolean }>, after: () => void) => start(async () => { setErr(""); const r = await f(); if (r?.error) setErr(r.error); else after(); });

  return (
    <div className="space-y-2 rounded-2xl border border-[#3a1f1f] p-3.5">
      <p className="text-[11px] uppercase tracking-[0.15em] text-[#ff8a7e]">{removed ? `${first} is removed` : `Remove ${first}`}</p>
      {!removed ? (
        ask === "remove" ? (
          <div className="space-y-2">
            <p className="text-[13px] text-[#cfcfcf]">She&apos;ll drop off your Clients list, stop getting reminders, and can&apos;t open the app (she&apos;ll see that her program has ended). Nothing is deleted. You can restore her anytime.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAsk("")} className="min-h-10 flex-1 rounded-xl border border-border text-[13px]">Cancel</button>
              <button type="button" disabled={pending} onClick={() => run(() => removeClient(clientId), () => { router.push("/coach"); router.refresh(); })} className="min-h-10 flex-1 rounded-xl bg-[#b3261e] text-[13px] font-semibold text-white disabled:opacity-50">{pending ? "Removing…" : `Yes, remove ${first}`}</button>
            </div>
          </div>
        ) : <button type="button" onClick={() => setAsk("remove")} className="min-h-10 rounded-xl border border-[#5a2a2a] px-3 text-[13px] text-[#ff8a7e]">Remove from my clients</button>
      ) : (
        <div className="space-y-2">
          <p className="text-[13px] text-dim">She&apos;s off your Clients list and can&apos;t open the app. All her history is kept.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={() => run(() => restoreClient(clientId), () => router.refresh())} className="min-h-10 rounded-xl bg-accent px-3 text-[13px] font-semibold text-black disabled:opacity-50">Restore {first}</button>
            {ask !== "delete" && <button type="button" onClick={() => setAsk("delete")} className="min-h-10 rounded-xl border border-[#5a2a2a] px-3 text-[13px] text-[#ff8a7e]">Delete permanently…</button>}
          </div>
          {ask === "delete" && (
            <div className="space-y-2 rounded-xl border border-[#5a2a2a] bg-[#1a0f0f] p-3">
              <p className="text-[13px] text-[#ffb4ab]"><b>This can&apos;t be undone.</b> Her account, weigh-ins, food logs, check-ins, chat, photos and videos are deleted for good. Type <b>{first}</b> to confirm.</p>
              <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={first} aria-label={`Type ${first} to confirm`}
                className="min-h-11 w-full rounded-xl border border-[#5a2a2a] bg-bg px-3 text-[15px] outline-none" />
              <div className="flex gap-2">
                <button type="button" onClick={() => { setAsk(""); setTyped(""); }} className="min-h-10 flex-1 rounded-xl border border-border text-[13px]">Cancel</button>
                <button type="button" disabled={pending || typed.trim().toLowerCase() !== first.toLowerCase()} onClick={() => run(() => deleteClientForever(clientId, typed), () => { router.push("/coach/removed"); router.refresh(); })}
                  className="min-h-10 flex-1 rounded-xl bg-[#b3261e] text-[13px] font-semibold text-white disabled:opacity-40">{pending ? "Deleting…" : "Delete forever"}</button>
              </div>
            </div>
          )}
        </div>
      )}
      {err && <p className="text-sm text-[var(--red)]">{err}</p>}
    </div>
  );
}
