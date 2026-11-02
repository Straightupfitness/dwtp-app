"use client";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import Avatar from "@/components/Avatar";
import { sendBulk } from "@/components/chat/actions";
import SeenStrip, { lastInLabel } from "@/components/SeenStrip";
import { resendWelcome } from "./clients/[id]/actions";
import { TextLink } from "./clients/[id]/WelcomeButton";
import type { RosterRow } from "@/lib/roster";

type SortKey = "attention" | "name" | "seen" | "weighins" | "checkin" | "kcalAvg" | "protein" | "steps" | "workouts";
const SORT_VALUE: Record<Exclude<SortKey, "attention" | "name">, (r: RosterRow) => number | null> = {
  seen: (r) => r.hoursSinceSeen ?? 1e9, weighins: (r) => r.weighins7, checkin: (r) => (r.lastCheckin ? Date.parse(r.lastCheckin.at) : null), kcalAvg: (r) => r.kcalAvg,
  protein: (r) => r.proteinAvg, steps: (r) => r.stepsAvg, workouts: (r) => (r.lastWorkoutWeek?.planned ? r.lastWorkoutWeek.done / r.lastWorkoutWeek.planned : null),
};
const COLS = "md:grid-cols-[24px_minmax(160px,1.3fr)_minmax(140px,1fr)_minmax(125px,0.9fr)_minmax(120px,0.9fr)_repeat(4,minmax(58px,0.7fr))_minmax(200px,1.4fr)]";
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric" });
const at = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" });
type Filter = "all" | "open" | "reply" | "checkin" | "food" | "workout" | "seen";
const FILTERS: { key: Filter; label: string; test: (r: RosterRow) => boolean }[] = [
  { key: "all", label: "All clients", test: () => true },
  // November 1: check-ins are open (Fri–Mon noon) and she hasn't sent hers yet: who to remind.
  { key: "open", label: "Hasn't checked in yet", test: (r) => r.checkin?.state === "open" },
  { key: "reply", label: "Needs a reply", test: (r) => r.checkin?.state === "needs-reply" },
  { key: "checkin", label: "Missed check-in", test: (r) => r.missedCheckin },
  { key: "food", label: "No food logged yesterday", test: (r) => r.noFoodYesterday },
  { key: "workout", label: "Missed last week's workouts", test: (r) => r.missedWorkouts },
  { key: "seen", label: "Not in the app 48h+", test: (r) => r.notSeen48 },
];
const personalize = (t: string, first: string) => t.replace(/\{\s*first\s*(name)?\s*\}|\[\s*first\s*name\s*\]|\bfirst_?name\b/gi, first);
const ago = (h: number | null) => (h === null ? "never" : h < 1 ? "just now" : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`);
const startLabel = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const k = (n: number | null) => (n === null ? "–" : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

/** How far off target: green within 100 kcal, amber within 250, red beyond. */
function kcalTone(v: number | null, target: number | null) {
  if (v === null || !target) return "";
  const d = Math.abs(v - target);
  return d <= 100 ? "text-[#7ee2a8]" : d <= 250 ? "text-accent" : "text-[#fb7185]";
}


/**
 * Every client at a glance (October 29): weight, steps, food, check-in, workouts and when she was last in the app.
 * Filter to who needs a nudge, tick them, and send each one a personal message ("Hi {first}, …").
 */
export default function RosterView({ rows }: { rows: RosterRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSortState] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "attention", dir: 1 });
  // Tap a column heading to sort by it (November 1: "Client" = A–Z); tap again to flip the order.
  const setSort = (key: SortKey) => setSortState((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }));
  const [actionMsg, setActionMsg] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState("Hi {first}, ");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  const score = (r: RosterRow) => (r.checkin?.state === "needs-reply" ? 8 : 0) + (r.missedCheckin ? 4 : 0) + (r.noFoodYesterday ? 2 : 0) + (r.missedWorkouts ? 2 : 0) + (r.notSeen48 ? 3 : 0) + ((r.daysSinceWeigh ?? 99) >= 4 ? 1 : 0);
  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter)!;
    const q = search.trim().toLowerCase();
    const list = rows.filter(f.test).filter((r) => !q || r.name.toLowerCase().includes(q) || (r.email ?? "").toLowerCase().includes(q));
    return list.sort((a, b) => {
      if (sort.key === "name") return sort.dir * a.name.localeCompare(b.name);
      if (sort.key === "attention") return sort.dir * (score(b) - score(a)) || a.name.localeCompare(b.name);
      // Biggest first (longest away, heaviest, most calories…); empty values always last.
      const f = SORT_VALUE[sort.key], x = f(a), y = f(b);
      if (x === null || y === null) return x === null && y === null ? a.name.localeCompare(b.name) : x === null ? 1 : -1;
      return sort.dir * (y - x) || a.name.localeCompare(b.name);
    });
  }, [rows, filter, sort, search]);
  const allPicked = shown.length > 0 && shown.every((r) => picked.has(r.id));
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const pickedRows = rows.filter((r) => picked.has(r.id));
  const chip = (on: boolean) => `shrink-0 rounded-full border px-3 py-1.5 text-[13px] ${on ? "border-accent bg-accent font-semibold text-black" : "border-[#2f2f2f] text-[#cfcfcf]"}`;

  return (
    <div className={`space-y-3 ${picked.size ? "pb-56" : "pb-24"}`}>
      {/* Find a client by name (October 30). */}
      <div className="relative">
        <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients by name or email" aria-label="Search clients"
          className="min-h-12 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-[15px] outline-none focus:border-accent" />
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
        {FILTERS.map((f) => {
          const n = rows.filter(f.test).length;
          return <button key={f.key} type="button" onClick={() => setFilter(f.key)} aria-pressed={filter === f.key} className={chip(filter === f.key)}>{f.label} <span className="opacity-70">{n}</span></button>;
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <label className="flex min-h-9 items-center gap-2 rounded-full border border-border px-3">
          <input type="checkbox" checked={allPicked} onChange={() => setPicked((p) => { const n = new Set(p); for (const r of shown) { if (allPicked) n.delete(r.id); else n.add(r.id); } return n; })} className="size-4 accent-[var(--accent)]" />
          Select all {shown.length}
        </label>
        <span className="text-dim">Sort:</span>
        {([["attention", "Needs attention"], ["name", "A–Z"], ["seen", "Longest away"]] as const).map(([v, l]) => (
          <button key={v} type="button" onClick={() => setSort(v)} aria-pressed={sort.key === v} className={`min-h-9 rounded-full border px-3 ${sort.key === v ? "border-accent text-accent" : "border-border text-dim"}`}>{l}{sort.key === v && sort.dir === -1 ? " ↑" : ""}</button>
        ))}
      </div>

      {/* One compact row per client (October 31): numbers in columns, alerts stacked on the right. */}
      <div className={`sticky top-[calc(env(safe-area-inset-top)+56px)] z-10 grid grid-cols-6 gap-1 bg-bg/95 py-1.5 pl-[42px] pr-2.5 md:px-2.5 text-[10px] uppercase tracking-[0.06em] text-dim backdrop-blur ${COLS} md:gap-2`}>
        <span className="hidden md:block" />
        {([["name", "Client", "hidden md:block"], ["seen", "Last in app", "hidden md:block"], ["weighins", "Weigh-ins"], ["checkin", "Last check-in"], ["kcalAvg", "Kcal avg"], ["protein", "Protein"], ["steps", "Steps"], ["workouts", "Workouts"]] as [SortKey, string, string?][]).map(([key, label, cls]) => (
          <button key={key} type="button" onClick={() => setSort(key)} aria-label={`Sort by ${label}`}
            className={`text-left uppercase ${cls ?? ""} ${sort.key === key ? "text-accent" : "hover:text-text"}`}>{label}{sort.key === key ? (sort.key === "name" ? (sort.dir === 1 ? " ↓" : " ↑") : sort.dir === 1 ? " ↓" : " ↑") : ""}</button>
        ))}
        <span className="hidden text-right md:block">Alerts</span>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {shown.map((r) => {
          const on = picked.has(r.id);
          const wk = r.lastWorkoutWeek;
          const cell = "min-w-0 md:order-3";
          const val = "block truncate text-[14px] font-semibold tabular-nums";
          const sub = "block truncate text-[10px] text-dim";
          const alerts: { text: string; cls: string; href?: string }[] = [];
          if (r.checkin?.state === "needs-reply") alerts.push({ text: `Wk ${r.checkin.week}: reply`, cls: "border border-accent text-accent", href: `/coach/checkins/${r.checkin.id}` });
          if (r.missedCheckin) alerts.push({ text: "Missed check-in", cls: "bg-[#2a1218] text-[#fb7185]" });
          if (r.noFoodYesterday) alerts.push({ text: "No food yesterday", cls: "bg-[#2a1a10] text-gold" });
          if (r.missedWorkouts) alerts.push({ text: "Missed workouts", cls: "bg-[#2a1a10] text-gold" });
          if (r.notSeen48 && r.week > 0) alerts.push({ text: `Away ${ago(r.hoursSinceSeen)}`, cls: "bg-[#1d1d2a] text-[#a5b4fc]" });
          if ((r.daysSinceWeigh ?? 99) >= 4 && r.week > 0) alerts.push({ text: r.weighedOn ? `No weigh-in ${r.daysSinceWeigh}d` : "No weigh-ins", cls: "bg-[#2a1218] text-[#fb7185]" });
          // The check-in reply goes first; the rest wrap two to a line, so a row stays short.
          for (const f of r.flags) alerts.push({ text: f, cls: "bg-[#2a1a10] text-gold" });
          return (
            <li key={r.id} className={`grid grid-cols-[24px_1fr_auto] items-center gap-x-2 gap-y-1.5 px-2.5 py-2 ${COLS} md:gap-x-2 ${on ? "bg-accent/10" : ""}`}>
              <input type="checkbox" checked={on} onChange={() => toggle(r.id)} aria-label={`Select ${r.name}`} className="size-[18px] accent-[var(--accent)] md:order-1" />
              <Link href={`/coach/clients/${r.id}`} className="flex min-w-0 items-center gap-2 md:order-2">
                <Avatar name={r.name} path={r.avatar} size={32} />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold leading-tight">{r.name}</span>
                  <span className="block truncate text-[11px] text-dim">{r.week ? `Wk ${r.week}` : r.start ? `Starts ${startLabel(r.start)}` : "Not started"} · {r.cpsWeek} CPs<span className="md:hidden"> · in app {lastInLabel(r.seen).toLowerCase()}</span></span>
                  <span className="mt-0.5 block md:hidden"><SeenStrip seen={r.seen} size={12} /></span>
                </span>
              </Link>
              {/* Alerts, stacked on the right. */}
              <span className="flex max-w-[230px] flex-wrap content-center justify-end gap-0.5 justify-self-end md:order-4 md:max-w-none">
                {alerts.map((x, i) => x.href
                  ? <Link key={i} href={x.href} className={`whitespace-nowrap rounded px-1.5 py-px text-[11px] ${x.cls}`}>{x.text}</Link>
                  : <span key={i} className={`whitespace-nowrap rounded px-1.5 py-px text-[11px] ${x.cls}`}>{x.text}</span>)}
                {!alerts.length && <span className="text-[11px] text-[#7ee2a8]">On track</span>}
              </span>
              <span className="col-span-3 grid grid-cols-6 gap-1 pl-[32px] md:contents">
                <span className="hidden min-w-0 md:order-3 md:block">
                  <span className="block truncate text-[13px] font-semibold">{lastInLabel(r.seen)}</span>
                  <SeenStrip seen={r.seen} size={14} />
                </span>
                {/* November 1: her last 7 days of weigh-ins instead of the number. */}
                <span className={cell}>
                  <span className="hidden md:block"><SeenStrip seen={r.weighins} size={14} what="weighed in" /></span>
                  <span className={`${val} md:hidden`}>{r.weighins7}/7</span>
                  <span className={sub}><span className="hidden md:inline">{r.weighins7}/7 · </span>{r.weighedOn ? (r.daysSinceWeigh === 0 ? "today" : `last ${r.daysSinceWeigh}d ago`) : "none yet"}</span>
                </span>
                {/* Her last check-in: green when it's this week's. */}
                {(() => {
                  const c = r.lastCheckin, current = !!c && !!r.checkin && c.week === r.checkin.week;
                  return c
                    ? <Link href={`/coach/checkins/${c.id}`} className={cell}><span className={`${val} ${current ? "text-[#7ee2a8]" : ""}`}>{current ? "✓ " : ""}{when(c.at)}</span><span className={sub}>{c.week >= 1 ? `Week ${c.week}` : "Pre-launch"} · {at(c.at)}</span></Link>
                    : <span className={cell}><span className={`${val} text-dim`}>–</span><span className={sub}>no check-ins</span></span>;
                })()}
                <span className={cell}><span className={`${val} ${kcalTone(r.kcalAvg, r.kcalTarget)}`}>{r.kcalAvg ?? "–"}</span><span className={sub}>{r.foodDays7}/7 days</span></span>
                <span className={cell}><span className={`${val} ${r.proteinAvg !== null && r.proteinAvg < r.proteinTarget - 10 ? "text-accent" : ""}`}>{r.proteinAvg !== null ? `${r.proteinAvg}g` : "–"}</span><span className={sub}>of {r.proteinTarget}g</span></span>
                <span className={cell}><span className={val}>{k(r.stepsAvg)}</span><span className={sub}>{r.stepsDays ? `${r.stepsDays}d synced` : "not synced"}</span></span>
                <span className={cell}><span className={`${val} ${r.missedWorkouts ? "text-[#fb7185]" : wk && wk.planned ? "text-[#7ee2a8]" : ""}`}>{wk ? `${wk.done}/${wk.planned}` : "–"}</span><span className={sub}>{wk ? `wk ${wk.week}` : "from wk 2"}</span></span>
              </span>
            </li>
          );
        })}
      </ul>
      {!shown.length && <p className="rounded-2xl border border-dashed border-[#2f2f2f] p-6 text-center text-dim">Nobody here. Nice.</p>}

      {/* What to do with the ones he ticked (November 1): chat, her pages, sign-in help, emails. */}
      {picked.size > 0 && (() => {
        const one = pickedRows.length === 1 ? pickedRows[0] : null;
        const act = "inline-flex min-h-10 shrink-0 items-center rounded-xl border border-border px-3 text-[13px] font-semibold hover:border-accent";
        return (
          <div className="fixed inset-x-0 z-30 bottom-[calc(env(safe-area-inset-bottom)+57px)] border-t border-border bg-bg/95 px-4 py-2.5 backdrop-blur">
            <div className="mx-auto max-w-5xl space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate text-sm">{one ? <b>{one.name}</b> : <><b>{picked.size}</b> selected</>}</span>
                <button type="button" onClick={() => { setPicked(new Set()); setActionMsg(""); }} className="min-h-10 rounded-xl px-3 text-sm text-dim">Clear</button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-0.5">
                {one
                  ? <Link href={`/coach/inbox/${one.id}`} className={`${act} border-accent bg-accent text-black`}>Message in chat</Link>
                  : <button type="button" onClick={() => { setComposing(true); setMsg(""); }} className={`${act} border-accent bg-accent text-black`}>Message {picked.size} in chat</button>}
                {one && <Link href={`/coach/clients/${one.id}`} className={act}>Open her page</Link>}
                {one?.checkin?.id && <Link href={`/coach/checkins/${one.checkin.id}`} className={act}>Week {one.checkin.week} check-in</Link>}
                {one && <Link href={`/coach/clients/${one.id}#food`} className={act}>Food · 7 days</Link>}
                {one && <Link href={`/coach/clients/${one.id}/workouts`} className={act}>Workouts</Link>}
                <button type="button" disabled={pending} onClick={() => start(async () => {
                  let ok = 0;
                  for (const r of pickedRows) { const x = await resendWelcome(r.id).catch(() => ({ ok: false })); if (x.ok) ok++; }
                  setActionMsg(`Sign-in email sent to ${ok} of ${pickedRows.length}.`);
                })} className={act}>{pending ? "Sending…" : `Email sign-in link${one ? "" : "s"}`}</button>
                <button type="button" onClick={async () => {
                  const list = pickedRows.map((r) => r.email).filter(Boolean).join(", ");
                  try { await navigator.clipboard.writeText(list); setActionMsg(`Copied ${pickedRows.filter((r) => r.email).length} email address${pickedRows.length === 1 ? "" : "es"}.`); } catch { setActionMsg(list); }
                }} className={act}>Copy email{one ? "" : "s"}</button>
              </div>
              {one && <div className="[&>button]:min-h-10"><TextLink key={one.id} clientId={one.id} /></div>}
              {actionMsg && <p className="text-[13px] text-dim">{actionMsg}</p>}
            </div>
          </div>
        );
      })()}
      {composing && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Message clients">
          <div className="w-full max-w-lg space-y-3 rounded-[20px] border border-border bg-[#121212] p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-[family-name:var(--font-display)] text-xl uppercase">Message {picked.size} client{picked.size === 1 ? "" : "s"}</h2>
              <button type="button" onClick={() => setComposing(false)} className="min-h-9 px-2 text-dim" aria-label="Close">✕</button>
            </div>
            <p className="text-[13px] text-dim">Each one gets her own message in her chat. <b className="text-text">{"{first}"}</b> becomes her first name (&ldquo;firstname&rdquo; works too).</p>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} autoFocus aria-label="Message"
              className="w-full rounded-xl border border-border bg-card p-3 text-base outline-none focus:border-accent" />
            <button type="button" onClick={() => setText((t) => `${t}{first}`)} className="min-h-9 rounded-full border border-border px-3 text-[13px]">+ Insert first name</button>
            {pickedRows[0] && text.trim() && (
              <div className="rounded-xl border border-border bg-card p-3 text-[14px]">
                <p className="mb-1 text-[11px] uppercase tracking-[0.1em] text-dim">What {pickedRows[0].first} sees</p>
                <p className="whitespace-pre-line">{personalize(text, pickedRows[0].first)}</p>
              </div>
            )}
            <p className="text-[12px] text-dim">To: {pickedRows.slice(0, 8).map((r) => r.first).join(", ")}{pickedRows.length > 8 ? ` and ${pickedRows.length - 8} more` : ""}</p>
            <button type="button" disabled={pending || !text.trim()} onClick={() => start(async () => {
              const r = await sendBulk([...picked], text);
              if (r?.error) setMsg(r.error); else { setMsg(`Sent to ${r?.sent} clients.`); setPicked(new Set()); setTimeout(() => setComposing(false), 1200); }
            })} className="min-h-12 w-full rounded-xl bg-accent font-semibold text-black disabled:opacity-50">{pending ? "Sending…" : `Send ${picked.size} personal message${picked.size === 1 ? "" : "s"}`}</button>
            {msg && <p className="text-sm">{msg}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
