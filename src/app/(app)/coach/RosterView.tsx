"use client";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import Avatar from "@/components/Avatar";
import { sendBulk } from "@/components/chat/actions";
import type { RosterRow } from "@/lib/roster";

type Filter = "all" | "reply" | "checkin" | "food" | "workout" | "seen";
const FILTERS: { key: Filter; label: string; test: (r: RosterRow) => boolean }[] = [
  { key: "all", label: "All clients", test: () => true },
  { key: "reply", label: "Needs a reply", test: (r) => r.checkin?.state === "needs-reply" },
  { key: "checkin", label: "Missed check-in", test: (r) => r.missedCheckin },
  { key: "food", label: "No food logged yesterday", test: (r) => r.noFoodYesterday },
  { key: "workout", label: "Missed last week's workouts", test: (r) => r.missedWorkouts },
  { key: "seen", label: "Not in the app 48h+", test: (r) => r.notSeen48 },
];
const personalize = (t: string, first: string) => t.replace(/\{\s*first\s*(name)?\s*\}|\[\s*first\s*name\s*\]|\bfirst_?name\b/gi, first);
const ago = (h: number | null) => (h === null ? "never" : h < 1 ? "just now" : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`);
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
  const [sort, setSort] = useState<"attention" | "az" | "seen">("attention");
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
    return list.sort((a, b) => sort === "az" ? a.name.localeCompare(b.name)
      : sort === "seen" ? (b.hoursSinceSeen ?? 1e9) - (a.hoursSinceSeen ?? 1e9)
      : score(b) - score(a) || a.name.localeCompare(b.name));
  }, [rows, filter, sort, search]);
  const allPicked = shown.length > 0 && shown.every((r) => picked.has(r.id));
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const pickedRows = rows.filter((r) => picked.has(r.id));
  const chip = (on: boolean) => `shrink-0 rounded-full border px-3 py-1.5 text-[13px] ${on ? "border-accent bg-accent font-semibold text-black" : "border-[#2f2f2f] text-[#cfcfcf]"}`;

  return (
    <div className="space-y-3 pb-24">
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
        {([["attention", "Needs attention"], ["az", "A–Z"], ["seen", "Longest away"]] as const).map(([v, l]) => (
          <button key={v} type="button" onClick={() => setSort(v)} aria-pressed={sort === v} className={`min-h-9 rounded-full border px-3 ${sort === v ? "border-accent text-accent" : "border-border text-dim"}`}>{l}</button>
        ))}
      </div>

      {/* One compact row per client (October 31): numbers in columns, alerts stacked on the right. */}
      <div className="sticky top-[calc(env(safe-area-inset-top)+56px)] z-10 grid grid-cols-6 gap-1 bg-bg/95 py-1.5 pl-[42px] pr-2.5 md:px-2.5 text-[10px] uppercase tracking-[0.06em] text-dim backdrop-blur md:grid-cols-[24px_minmax(170px,1.5fr)_repeat(6,minmax(58px,1fr))_minmax(230px,1.6fr)] md:gap-2">
        <span className="hidden md:block" /><span className="hidden md:block">Client</span>
        <span>Weight</span><span>Kcal yday</span><span>Kcal avg</span><span>Protein</span><span>Steps</span><span>Workouts</span>
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
            <li key={r.id} className={`grid grid-cols-[24px_1fr_auto] items-center gap-x-2 gap-y-1.5 px-2.5 py-2 md:grid-cols-[24px_minmax(170px,1.5fr)_repeat(6,minmax(58px,1fr))_minmax(230px,1.6fr)] md:gap-x-2 ${on ? "bg-accent/10" : ""}`}>
              <input type="checkbox" checked={on} onChange={() => toggle(r.id)} aria-label={`Select ${r.name}`} className="size-[18px] accent-[var(--accent)] md:order-1" />
              <Link href={`/coach/clients/${r.id}`} className="flex min-w-0 items-center gap-2 md:order-2">
                <Avatar name={r.name} path={r.avatar} size={32} />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold leading-tight">{r.name}</span>
                  <span className="block truncate text-[11px] text-dim">{r.week ? `Wk ${r.week}` : "Not started"} · {r.cpsWeek} CPs · {ago(r.hoursSinceSeen)}</span>
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
                <span className={cell}><span className={`${val} ${(r.daysSinceWeigh ?? 99) >= 4 && r.week ? "text-[#fb7185]" : ""}`}>{r.weight ?? "–"}</span><span className={sub}>{r.weighedOn ? (r.daysSinceWeigh === 0 ? "today" : `${r.daysSinceWeigh}d ago`) : "none"}</span></span>
                <span className={cell}><span className={`${val} ${r.kcalYesterday === null ? (r.week ? "text-[#fb7185]" : "") : kcalTone(r.kcalYesterday, r.kcalTarget)}`}>{r.kcalYesterday ?? "–"}</span><span className={sub}>{r.kcalTarget ? `of ${r.kcalTarget}` : "no target"}</span></span>
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

      {/* Message the ones she ticked: one personal message each. */}
      {picked.size > 0 && (
        <div className="fixed inset-x-0 z-30 bottom-[calc(env(safe-area-inset-bottom)+57px)] border-t border-border bg-bg/95 px-4 py-2.5 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <span className="flex-1 text-sm"><b>{picked.size}</b> selected</span>
            <button type="button" onClick={() => setPicked(new Set())} className="min-h-11 rounded-xl border border-border px-3 text-sm text-dim">Clear</button>
            <button type="button" onClick={() => { setComposing(true); setMsg(""); }} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-black">Message {picked.size}</button>
          </div>
        </div>
      )}
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
