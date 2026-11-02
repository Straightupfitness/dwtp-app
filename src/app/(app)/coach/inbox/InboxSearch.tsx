"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";

type C = { id: string; name: string; email: string | null; avatar: string | null };

/** "Message…" (November 1): type a name, pick her, and her chat opens ready to type. */
export default function InboxSearch({ clients }: { clients: C[] }) {
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const router = useRouter();
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return clients.filter((c) => c.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(s)) || c.name.toLowerCase().includes(s) || (c.email ?? "").toLowerCase().startsWith(s))
      .sort((a, b) => Number(!a.name.toLowerCase().startsWith(s)) - Number(!b.name.toLowerCase().startsWith(s)) || a.name.localeCompare(b.name)).slice(0, 8);
  }, [q, clients]);
  const open = (c: C) => router.push(`/coach/inbox/${c.id}`);

  return (
    <div className="relative">
      <svg className="pointer-events-none absolute left-3 top-[24px] -translate-y-1/2 text-dim" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 5h16v11H8l-4 4z" /></svg>
      <input value={q} onChange={(e) => { setQ(e.target.value); setHi(0); }} placeholder="Message… type a client's name" aria-label="Find a client to message"
        role="combobox" aria-expanded={hits.length > 0} aria-controls="inbox-hits" autoComplete="off"
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, hits.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          if (e.key === "Enter" && hits[hi]) { e.preventDefault(); open(hits[hi]); }
          if (e.key === "Escape") setQ("");
        }}
        className="min-h-12 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-[15px] outline-none focus:border-accent" />
      {hits.length > 0 && (
        <ul id="inbox-hits" role="listbox" className="absolute inset-x-0 top-[52px] z-20 overflow-hidden rounded-xl border border-border bg-[#141414] shadow-2xl">
          {hits.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === hi}>
              <button type="button" onMouseEnter={() => setHi(i)} onClick={() => open(c)} className={`flex w-full items-center gap-3 px-3 py-2 text-left ${i === hi ? "bg-accent/15" : ""}`}>
                <Avatar name={c.name} path={c.avatar} size={32} />
                <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-semibold">{c.name}</span><span className="block truncate text-[12px] text-dim">{c.email}</span></span>
                <span className="text-[12px] text-accent">Message →</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim() && !hits.length && <p className="mt-1 text-[13px] text-dim">No client named &ldquo;{q.trim()}&rdquo;.</p>}
    </div>
  );
}
