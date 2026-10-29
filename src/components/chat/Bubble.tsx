"use client";
import { useState } from "react";
import { HeartButton } from "./Heart";

export const REPLY_EVENT = "dwtp:chat-reply";
export const EDIT_EVENT = "dwtp:chat-edit";
export type ReplyTo = { id: string; who: string; snippet: string };
export type EditMsg = { id: string; body: string };

export type BubbleMsg = {
  id: string; mine: boolean; body: string | null; photo: string | null; audio: string | null; seconds: number | null;
  edited: boolean; hearted: boolean; quote: { who: string; snippet: string } | null; senderName: string;
};

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/**
 * One chat message (October 29): tap it for Reply, Edit (her own words) and ♥. Shows the message it replies to,
 * a photo or a voice note, and "edited".
 */
export default function Bubble({ m }: { m: BubbleMsg }) {
  const [open, setOpen] = useState(false);
  const snippet = m.body ? m.body.slice(0, 90) : m.audio ? "🎤 Voice note" : "📷 Photo";
  const act = "min-h-9 rounded-full border border-border bg-card px-3 text-[13px] font-semibold";
  return (
    <div className={`flex flex-col ${m.mine ? "items-end" : "items-start"}`}>
      <div className={`flex items-end gap-1 ${m.mine ? "justify-end" : "justify-start"} w-full`}>
        <div role="button" tabIndex={0} onClick={() => setOpen(!open)} onKeyDown={(e) => { if (e.key === "Enter") setOpen(!open); }}
          aria-label="Message options"
          className={`relative max-w-[80%] cursor-pointer space-y-1 rounded-[18px] px-3.5 py-2.5 text-[15px] leading-snug ${m.mine ? "rounded-br-md bg-accent text-black" : "rounded-bl-md bg-[#1b1b1b]"} ${open ? "ring-2 ring-white/30" : ""}`}>
          {m.quote && (
            <span className={`block rounded-[10px] border-l-[3px] px-2 py-1 text-[13px] ${m.mine ? "border-black/40 bg-black/10" : "border-accent bg-white/5"}`}>
              <span className="block text-[11px] font-semibold opacity-80">{m.quote.who}</span>
              <span className="line-clamp-2 opacity-90">{m.quote.snippet}</span>
            </span>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL */}
          {m.photo && <img src={m.photo} alt="" className="rounded-[14px]" />}
          {m.audio && (
            <span className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <audio controls preload="metadata" src={m.audio} className="h-10 w-[230px] max-w-full" />
              {m.seconds ? <span className="text-[12px] opacity-70">{mmss(m.seconds)}</span> : null}
            </span>
          )}
          {m.body && <p className="whitespace-pre-line">{m.body}</p>}
          {m.edited && <span className={`block text-right text-[10px] ${m.mine ? "text-black/60" : "text-dim"}`}>edited</span>}
          {m.mine && m.hearted && <span className="absolute -bottom-2 -left-2 grid size-6 place-items-center rounded-full border-2 border-bg bg-[#2a1218] text-[12px] text-[#fb7185]" aria-label="Liked">♥</span>}
        </div>
        {!m.mine && <HeartButton id={m.id} hearted={m.hearted} />}
      </div>
      {open && (
        <div className="mt-1.5 flex gap-1.5">
          <button type="button" className={act} onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent<ReplyTo>(REPLY_EVENT, { detail: { id: m.id, who: m.mine ? "You" : m.senderName, snippet } })); }}>↩ Reply</button>
          {m.mine && m.body && <button type="button" className={act} onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent<EditMsg>(EDIT_EVENT, { detail: { id: m.id, body: m.body! } })); }}>✎ Edit</button>}
          {m.body && <button type="button" className={act} onClick={() => { setOpen(false); void navigator.clipboard?.writeText(m.body!); }}>Copy</button>}
        </div>
      )}
    </div>
  );
}
