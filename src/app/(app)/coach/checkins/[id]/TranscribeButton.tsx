"use client";
import { useTransition } from "react";
import { transcribeNow } from "./actions";

export default function TranscribeButton({ checkinId, label }: { checkinId: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => transcribeNow(checkinId))}
      className="min-h-11 rounded-lg border border-border px-3 text-sm disabled:opacity-50">{pending ? "Transcribing… (up to a minute)" : label}</button>
  );
}
