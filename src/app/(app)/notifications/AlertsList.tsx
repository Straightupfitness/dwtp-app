"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { markAllRead } from "./actions";

type N = { id: string; title: string; body: string; url: string; read_at: string | null; created_at: string };

/**
 * November 15 (Michael saw an empty Alerts page while the bell said 9): the list loads fresh from the server every
 * time the page opens, so a copy the browser saved earlier can't hide new alerts. Then everything is marked read.
 */
export default function AlertsList({ initial, tz, viewing }: { initial: N[]; tz: string; viewing: boolean }) {
  const [rows, setRows] = useState<N[]>(initial);
  useEffect(() => {
    let gone = false;
    fetch("/api/notifications", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d: N[] | null) => {
      if (gone || !Array.isArray(d)) return;
      setRows(d);
      if (!viewing && d.some((n) => !n.read_at)) markAllRead();
    }).catch(() => {});
    return () => { gone = true; };
  }, [viewing]);
  const when = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  if (!rows.length) return (
    <p className="rounded-2xl border border-dashed border-[#2f2f2f] p-6 text-center text-[14px] text-dim">
      {viewing ? "Her alerts are private to her." : "No alerts yet. New messages, check-in replies and new lessons show up here."}
    </p>
  );
  return (
    <ul className="divide-y divide-border rounded-[18px] border border-border bg-card">
      {rows.map((n) => (
        <li key={n.id}>
          <Link href={n.url || "/today"} className="flex gap-3 px-3.5 py-3">
            <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-accent"}`} aria-label={n.read_at ? undefined : "New"} />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold leading-snug">{n.title}</span>
              {n.body && <span className="mt-0.5 block text-[14px] leading-snug text-[#cfcfcf]">{n.body}</span>}
              <span className="mt-1 block text-[12px] text-dim">{when(n.created_at)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
