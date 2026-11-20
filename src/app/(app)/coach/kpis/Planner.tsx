"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Grip, useDnd } from "@/components/useDnd";
import { deleteItems, saveItems, type PlanItem } from "./items";

/**
 * November 19 (Michael): his planner on the KPIs tab: the action plan, the Eisenhower matrix and an outline that
 * works like Workflowy. Changes show right away and save a moment later.
 */

const uid = () => crypto.randomUUID();
const byPos = (a: PlanItem, b: PlanItem) => a.position - b.position;

/** All planner lines in one place, saved in the background. */
export function usePlan(initial: PlanItem[]) {
  const [items, setItems] = useState<PlanItem[]>(initial);
  const [status, setStatus] = useState<"" | "saving" | "saved" | string>("");
  const dirty = useRef(new Map<string, PlanItem>());
  const gone = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(items);
  useEffect(() => { latest.current = items; }, [items]);

  const flush = useCallback(async () => {
    const rows = [...dirty.current.values()].filter((r) => !gone.current.has(r.id));
    const del = [...gone.current];
    dirty.current.clear(); gone.current.clear();
    if (!rows.length && !del.length) return;
    setStatus("saving");
    const a = rows.length ? await saveItems(rows) : { ok: true as const };
    const b = del.length ? await deleteItems(del) : { ok: true as const };
    const err = ("error" in a && a.error) || ("error" in b && b.error);
    setStatus(err ? String(err) : "saved");
  }, []);
  const later = useCallback(() => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => { void flush(); }, 700); }, [flush]);
  useEffect(() => {
    const out = () => { if (dirty.current.size || gone.current.size) void flush(); };
    window.addEventListener("pagehide", out);
    return () => { window.removeEventListener("pagehide", out); out(); };
  }, [flush]);

  const put = useCallback((rows: PlanItem[]) => {
    setItems((cur) => { const m = new Map(cur.map((i) => [i.id, i])); for (const r of rows) { m.set(r.id, r); dirty.current.set(r.id, r); } return [...m.values()]; });
    later();
  }, [later]);
  const patch = useCallback((id: string, p: Partial<PlanItem>) => {
    const cur = latest.current.find((i) => i.id === id);
    if (cur) put([{ ...cur, ...p }]);
  }, [put]);
  const remove = useCallback((ids: string[]) => {
    // A line's children go with it.
    const all = new Set(ids);
    let grew = true;
    while (grew) { grew = false; for (const i of latest.current) if (i.parent_id && all.has(i.parent_id) && !all.has(i.id)) { all.add(i.id); grew = true; } }
    setItems((cur) => cur.filter((i) => !all.has(i.id)));
    for (const id of all) { gone.current.add(id); dirty.current.delete(id); }
    later();
  }, [later]);
  return { items, put, patch, remove, status };
}
type Plan = ReturnType<typeof usePlan>;

const Saved = ({ s }: { s: string }) => s ? <span className={`text-[11px] ${s === "saving" || s === "saved" ? "text-dim" : "text-[var(--red)]"}`}>{s === "saving" ? "Saving…" : s === "saved" ? "Saved" : s}</span> : null;

/** Place a line at a position: before `before`, or at the end. */
function posAt(list: PlanItem[], before: string | null, moving?: string) {
  const l = list.filter((i) => i.id !== moving).sort(byPos);
  if (!before) return (l.at(-1)?.position ?? 0) + 1;
  const i = l.findIndex((x) => x.id === before);
  if (i < 0) return (l.at(-1)?.position ?? 0) + 1;
  return i === 0 ? l[0].position - 1 : (l[i - 1].position + l[i].position) / 2;
}

/** A line of text she can tap to change. */
function InlineText({ value, onSave, className = "", done = false, placeholder }: { value: string; onSave: (v: string) => void; className?: string; done?: boolean; placeholder?: string }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(value);
  if (!edit) return <button type="button" onClick={() => { setV(value); setEdit(true); }} className={`min-w-0 flex-1 text-left ${done ? "text-dim line-through" : ""} ${className}`}>{value || <span className="text-dim">{placeholder ?? "Tap to write"}</span>}</button>;
  return (
    <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { setEdit(false); if (v !== value) onSave(v); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setV(value); setEdit(false); } }}
      className={`min-h-8 min-w-0 flex-1 rounded-md border border-accent bg-bg px-2 outline-none ${className}`} />
  );
}

// ── Action plan ─────────────────────────────────────────────

export function ActionPlan({ plan }: { plan: Plan }) {
  const list = plan.items.filter((i) => i.kind === "action").sort(byPos);
  const [text, setText] = useState("");
  const [showDone, setShowDone] = useState(true);
  const dnd = useDnd((id, _t, before) => plan.patch(id, { position: posAt(list, before, id) }));
  const add = () => { const t = text.trim(); if (!t) return; plan.put([{ id: uid(), kind: "action", parent_id: null, text: t, note: null, quadrant: null, position: posAt(list, null), done: false, collapsed: false }]); setText(""); };
  const shown = list.filter((i) => showDone || !i.done);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[12px] text-dim">
        <span>{list.filter((i) => i.done).length} of {list.length} done · drag to reorder</span>
        <span className="flex items-center gap-3"><Saved s={plan.status} /><button type="button" onClick={() => setShowDone((x) => !x)} className="underline">{showDone ? "Hide done" : "Show done"}</button></span>
      </div>
      <ol data-drop="action" className="divide-y divide-border rounded-xl border border-border">
        {shown.map((i, n) => (
          <li key={i.id} data-before={i.id} {...dnd.bind(i.id, i.text)} className="flex min-h-11 items-center gap-2 px-2 py-1.5">
            <Grip />
            <span className="w-6 shrink-0 text-right text-[12px] tabular-nums text-dim">{n + 1}.</span>
            <input type="checkbox" checked={i.done} onChange={(e) => plan.patch(i.id, { done: e.target.checked })} className="size-[18px] shrink-0 accent-[var(--accent)]" aria-label={`Done: ${i.text}`} />
            <InlineText value={i.text} done={i.done} onSave={(v) => plan.patch(i.id, { text: v })} className="text-[14px]" />
            <button type="button" onClick={() => plan.remove([i.id])} className="min-h-8 shrink-0 px-1.5 text-dim hover:text-[var(--red)]" aria-label={`Delete ${i.text}`}>✕</button>
          </li>
        ))}
        {!shown.length && <li className="p-3 text-[13px] text-dim">Nothing here yet. Add your first step below.</li>}
      </ol>
      <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a step to your action plan" className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-[14px] outline-none focus:border-accent" />
        <button className="min-h-11 shrink-0 rounded-xl bg-accent px-4 text-[14px] font-semibold text-black">Add</button>
      </form>
      {dnd.ghost}
    </div>
  );
}

// ── Eisenhower matrix ───────────────────────────────────────

const QUADS = [
  { q: 1, title: "Urgent & important", sub: "Do now", color: "#ef4444" },
  { q: 2, title: "Not urgent & important", sub: "Schedule", color: "#f5a623" },
  { q: 3, title: "Urgent, not important", sub: "Delegate", color: "#38bdf8" },
  { q: 4, title: "Not urgent, not important", sub: "Delete", color: "#6b6b6b" },
];

export function Matrix({ plan }: { plan: Plan }) {
  const all = plan.items.filter((i) => i.kind === "matrix");
  const [showDone, setShowDone] = useState(false);
  const dnd = useDnd((id, target, before) => {
    const q = Number(target.replace("q", ""));
    plan.patch(id, { quadrant: q, position: posAt(all.filter((i) => i.quadrant === q), before, id) });
  });
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[12px] text-dim">
        <span>Drag a task to another box. Tap one to change it.</span>
        <span className="flex items-center gap-3"><Saved s={plan.status} /><button type="button" onClick={() => setShowDone((x) => !x)} className="underline">{showDone ? "Hide done" : `Show done (${all.filter((i) => i.done).length})`}</button></span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {QUADS.map(({ q, title, sub, color }) => <Quadrant key={q} q={q} title={title} sub={sub} color={color} plan={plan} dnd={dnd} showDone={showDone}
          list={all.filter((i) => i.quadrant === q && (showDone || !i.done)).sort(byPos)} />)}
      </div>
      {dnd.ghost}
    </div>
  );
}

function Quadrant({ q, title, sub, color, list, plan, dnd, showDone }: { q: number; title: string; sub: string; color: string; list: PlanItem[]; plan: Plan; dnd: ReturnType<typeof useDnd>; showDone: boolean }) {
  const [text, setText] = useState("");
  const add = () => { const t = text.trim(); if (!t) return; plan.put([{ id: uid(), kind: "matrix", parent_id: null, text: t, note: null, quadrant: q, position: posAt(list, null), done: false, collapsed: false }]); setText(""); };
  return (
    <div data-drop={`q${q}`} className={`flex min-h-44 flex-col rounded-xl border bg-card p-2.5 transition ${dnd.over === `q${q}` ? "ring-2" : ""}`} style={{ borderColor: `${color}88`, ...(dnd.over === `q${q}` ? { boxShadow: `0 0 0 2px ${color}` } : {}) }}>
      <p className="text-[13px] font-semibold" style={{ color }}>{title}</p>
      <p className="text-[11px] uppercase tracking-[0.14em] text-dim">{sub}</p>
      <ul className="mt-1.5 flex-1 space-y-1">
        {list.map((i) => (
          <li key={i.id} data-before={i.id} {...dnd.bind(i.id, i.text)} className="flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-bg px-1.5 py-1">
            <Grip />
            <input type="checkbox" checked={i.done} onChange={(e) => plan.patch(i.id, { done: e.target.checked })} className="size-4 shrink-0 accent-[var(--accent)]" aria-label={`Done: ${i.text}`} />
            <InlineText value={i.text} done={i.done} onSave={(v) => plan.patch(i.id, { text: v })} className="text-[13px]" />
            <button type="button" onClick={() => plan.remove([i.id])} className="min-h-7 shrink-0 px-1 text-[12px] text-dim hover:text-[var(--red)]" aria-label={`Delete ${i.text}`}>✕</button>
          </li>
        ))}
        {!list.length && <li className="py-2 text-[12px] text-dim">{showDone ? "Nothing here." : "Nothing here. Add one or drag one in."}</li>}
      </ul>
      <form onSubmit={(e) => { e.preventDefault(); add(); }} className="mt-1.5 flex gap-1.5">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="+ Add a task" aria-label={`Add a task to ${title}`} className="min-h-9 min-w-0 flex-1 rounded-lg border border-border bg-bg px-2.5 text-[13px] outline-none focus:border-accent" />
      </form>
    </div>
  );
}

// ── Outline (like Workflowy) ────────────────────────────────

/** Indented text (tabs, spaces, "- " or "• " bullets) → lines with their depth. Workflowy's plain-text export works too. */
function parseOutline(text: string) {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  const indents = lines.map((l) => (l.match(/^[\t ]*/)?.[0] ?? "").replace(/\t/g, "    ").length);
  const steps = [...new Set(indents)].sort((a, b) => a - b);
  return lines.map((l, i) => {
    let t = l.trim().replace(/^([-*•◦▪]|\d+[.)])\s+/, "");
    const done = /^\[x\]\s*/i.test(t); t = t.replace(/^\[[ x]\]\s*/i, "");
    return { depth: steps.indexOf(indents[i]), text: t, done };
  });
}

export function Outline({ plan }: { plan: Plan }) {
  const items = useMemo(() => plan.items.filter((i) => i.kind === "outline"), [plan.items]);
  const kids = useMemo(() => {
    const m = new Map<string | null, PlanItem[]>();
    for (const i of items) { const k = i.parent_id && items.some((x) => x.id === i.parent_id) ? i.parent_id : null; (m.get(k) ?? m.set(k, []).get(k)!).push(i); }
    for (const l of m.values()) l.sort(byPos);
    return m;
  }, [items]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const [zoom, setZoom] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(true);
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState<{ id: string; at?: number } | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const refs = useRef(new Map<string, HTMLTextAreaElement>());
  const root = zoom && byId.has(zoom) ? zoom : null;

  // Search: show what matches and the lines above it.
  const needle = q.trim().toLowerCase();
  const keep = useMemo(() => {
    if (!needle) return null;
    const s = new Set<string>();
    for (const i of items) if (i.text.toLowerCase().includes(needle) || (i.note ?? "").toLowerCase().includes(needle)) {
      let c: PlanItem | undefined = i; while (c && !s.has(c.id)) { s.add(c.id); c = c.parent_id ? byId.get(c.parent_id) : undefined; }
    }
    return s;
  }, [needle, items, byId]);

  // What's on screen, in order, with depth.
  const rows = useMemo(() => {
    const out: { i: PlanItem; depth: number }[] = [];
    const walk = (pid: string | null, depth: number) => {
      for (const i of kids.get(pid) ?? []) {
        if (!showDone && i.done && !keep) continue;
        if (keep && !keep.has(i.id)) continue;
        out.push({ i, depth });
        if ((!i.collapsed || keep) && kids.get(i.id)?.length) walk(i.id, depth + 1);
      }
    };
    walk(root, 0);
    return out;
  }, [kids, root, showDone, keep]);

  useEffect(() => {
    if (!focus) return;
    const el = refs.current.get(focus.id);
    if (el) { el.focus(); const at = focus.at ?? el.value.length; el.setSelectionRange(at, at); setFocus(null); }
  }, [focus, rows]);

  const siblings = (i: PlanItem) => kids.get(i.parent_id && byId.has(i.parent_id) ? i.parent_id : null) ?? [];
  const newLine = (parent: string | null, position: number, text = ""): PlanItem => ({ id: uid(), kind: "outline", parent_id: parent, text, note: null, quadrant: null, position, done: false, collapsed: false });
  const after = (i: PlanItem) => { const s = siblings(i); const k = s.findIndex((x) => x.id === i.id); return s[k + 1] ? (i.position + s[k + 1].position) / 2 : i.position + 1; };

  function enter(i: PlanItem, el: HTMLTextAreaElement) {
    const a = el.selectionStart ?? i.text.length;
    const before = i.text.slice(0, a), rest = i.text.slice(a);
    const open = (kids.get(i.id)?.length ?? 0) > 0 && !i.collapsed;
    if (a === 0 && i.text) { // at the very start: a new empty line above
      const s = siblings(i); const k = s.findIndex((x) => x.id === i.id);
      const n = newLine(i.parent_id, k > 0 ? (s[k - 1].position + i.position) / 2 : i.position - 1);
      plan.put([n]); setFocus({ id: n.id }); return;
    }
    const n = open ? newLine(i.id, ((kids.get(i.id) ?? [])[0]?.position ?? 1) - 1, rest) : newLine(i.parent_id, after(i), rest);
    plan.put([{ ...i, text: before }, n]); setFocus({ id: n.id, at: 0 });
  }
  function indent(i: PlanItem) {
    const s = siblings(i); const k = s.findIndex((x) => x.id === i.id);
    if (k <= 0) return;
    const p = s[k - 1]; const last = (kids.get(p.id) ?? []).at(-1);
    plan.put([{ ...p, collapsed: false }, { ...i, parent_id: p.id, position: (last?.position ?? 0) + 1 }]); setFocus({ id: i.id });
  }
  function outdent(i: PlanItem) {
    if (!i.parent_id || i.parent_id === root) return;
    const p = byId.get(i.parent_id); if (!p) return;
    plan.put([{ ...i, parent_id: p.parent_id, position: after(p) }]); setFocus({ id: i.id });
  }
  function move(i: PlanItem, dir: -1 | 1) {
    const s = siblings(i); const k = s.findIndex((x) => x.id === i.id); const o = s[k + dir];
    if (!o) return;
    plan.put([{ ...i, position: o.position }, { ...o, position: i.position }]); setFocus({ id: i.id });
  }
  function del(i: PlanItem, idx: number) {
    const prev = rows[idx - 1]?.i;
    plan.remove([i.id]);
    if (prev) setFocus({ id: prev.id });
  }
  function paste(i: PlanItem, e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const text = e.clipboardData.getData("text/plain");
    if (!text.includes("\n")) return;
    e.preventDefault();
    const lines = parseOutline(text);
    if (!lines.length) return;
    const out: PlanItem[] = []; const stack: { depth: number; id: string | null; last: number }[] = [];
    let pos = i.text ? after(i) : i.position;
    const parentBase = i.parent_id;
    let first = true;
    for (const l of lines) {
      while (stack.length && stack.at(-1)!.depth >= l.depth) stack.pop();
      const parent = stack.length ? stack.at(-1)!.id : parentBase;
      const p = stack.length ? ++stack.at(-1)!.last : pos++;
      const row = first && !i.text ? { ...i, text: l.text, done: l.done } : { ...newLine(parent, p, l.text), done: l.done };
      first = false;
      out.push(row);
      stack.push({ depth: l.depth, id: row.id, last: 0 });
    }
    plan.put(out);
  }
  function key(e: React.KeyboardEvent<HTMLTextAreaElement>, i: PlanItem, idx: number) {
    const el = e.currentTarget, mod = e.metaKey || e.ctrlKey;
    if (e.key === "Enter" && mod) { e.preventDefault(); plan.patch(i.id, { done: !i.done }); return; }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enter(i, el); return; }
    if (e.key === "Tab") { e.preventDefault(); if (e.shiftKey) outdent(i); else indent(i); return; }
    if (e.key === "Backspace" && !i.text && !(kids.get(i.id)?.length)) { e.preventDefault(); del(i, idx); return; }
    if (e.key === "Backspace" && mod && e.shiftKey) { e.preventDefault(); del(i, idx); return; }
    if (e.key === "ArrowUp" && mod && e.shiftKey) { e.preventDefault(); move(i, -1); return; }
    if (e.key === "ArrowDown" && mod && e.shiftKey) { e.preventDefault(); move(i, 1); return; }
    if (e.key === "ArrowUp" && mod) { e.preventDefault(); if (kids.get(i.id)?.length) plan.patch(i.id, { collapsed: true }); return; }
    if (e.key === "ArrowDown" && mod) { e.preventDefault(); plan.patch(i.id, { collapsed: false }); return; }
    if (e.key === "ArrowUp" && !e.shiftKey && el.selectionStart === el.selectionEnd && !el.value.slice(0, el.selectionStart).includes("\n")) {
      const p = rows[idx - 1]; if (p) { e.preventDefault(); setFocus({ id: p.i.id }); } return;
    }
    if (e.key === "ArrowDown" && !e.shiftKey && el.selectionStart === el.selectionEnd && !el.value.slice(el.selectionEnd).includes("\n")) {
      const n = rows[idx + 1]; if (n) { e.preventDefault(); setFocus({ id: n.i.id, at: 0 }); } return;
    }
  }
  const crumbs: PlanItem[] = [];
  for (let c = root ? byId.get(root) : undefined; c; c = c.parent_id ? byId.get(c.parent_id) : undefined) crumbs.unshift(c);
  const addFirst = () => { const n = newLine(root, ((kids.get(root) ?? []).at(-1)?.position ?? 0) + 1); plan.put([n]); setFocus({ id: n.id }); };
  const setAll = (collapsed: boolean) => plan.put(items.filter((i) => (kids.get(i.id)?.length ?? 0) > 0 && i.collapsed !== collapsed).map((i) => ({ ...i, collapsed })));
  const act = active ? byId.get(active) : undefined;
  const actIdx = act ? rows.findIndex((r) => r.i.id === act.id) : -1;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your outline" aria-label="Search the outline" className="min-h-10 min-w-[10rem] flex-1 rounded-xl border border-border bg-card px-3 text-[14px] outline-none focus:border-accent" />
        <button type="button" onClick={() => setShowDone((x) => !x)} className="min-h-10 rounded-xl border border-border px-3 text-[12px] text-dim">{showDone ? "Hide completed" : "Show completed"}</button>
        <button type="button" onClick={() => setAll(false)} className="min-h-10 rounded-xl border border-border px-3 text-[12px] text-dim">Expand all</button>
        <button type="button" onClick={() => setAll(true)} className="min-h-10 rounded-xl border border-border px-3 text-[12px] text-dim">Collapse all</button>
        <Saved s={plan.status} />
      </div>
      {/* Where she is: Home › Project › … (tap a bullet to zoom in). */}
      <p className="flex flex-wrap items-center gap-1 text-[13px]">
        <button type="button" onClick={() => setZoom(null)} className={root ? "text-accent underline" : "font-semibold"}>Home</button>
        {crumbs.map((c, k) => <span key={c.id} className="flex items-center gap-1"><span className="text-dim">›</span>
          <button type="button" onClick={() => setZoom(c.id)} className={k === crumbs.length - 1 ? "max-w-[14rem] truncate font-semibold" : "max-w-[10rem] truncate text-accent underline"}>{c.text || "Untitled"}</button></span>)}
      </p>
      {root && byId.get(root) && (
        <textarea value={byId.get(root)!.text} onChange={(e) => plan.patch(root, { text: e.target.value })} rows={1} aria-label="Title"
          className="w-full resize-none bg-transparent font-[family-name:var(--font-display)] text-2xl uppercase outline-none" />
      )}
      <div className="rounded-xl border border-border bg-card px-1 py-1.5">
        {rows.map(({ i, depth }, idx) => {
          const has = (kids.get(i.id)?.length ?? 0) > 0;
          return (
            <div key={i.id} className="group flex items-start" style={{ paddingLeft: depth * 22 }}>
              <button type="button" onClick={() => has && plan.patch(i.id, { collapsed: !i.collapsed })} aria-label={has ? (i.collapsed ? "Expand" : "Collapse") : undefined} tabIndex={-1}
                className={`grid h-7 w-5 shrink-0 place-items-center text-[10px] text-dim ${has ? "opacity-60 hover:opacity-100 md:opacity-0 md:group-hover:opacity-100" : "invisible"}`}>{i.collapsed ? "▶" : "▼"}</button>
              <button type="button" onClick={() => setZoom(i.id)} aria-label={`Zoom into ${i.text || "this line"}`} tabIndex={-1}
                className="grid h-7 w-5 shrink-0 place-items-center">
                <span className={`block size-[7px] rounded-full ${i.done ? "bg-[#5a5a5a]" : "bg-[#d0d0d0]"} ${has && i.collapsed ? "outline outline-[5px] outline-[#3a3a3a]" : ""}`} />
              </button>
              <textarea ref={(el) => { if (el) { refs.current.set(i.id, el); el.style.height = "0px"; el.style.height = `${el.scrollHeight}px`; } else refs.current.delete(i.id); }}
                value={i.text} rows={1} onChange={(e) => plan.patch(i.id, { text: e.target.value.replace(/\n/g, " ") })}
                onKeyDown={(e) => key(e, i, idx)} onPaste={(e) => paste(i, e)} onFocus={() => setActive(i.id)}
                className={`min-h-7 flex-1 resize-none overflow-hidden bg-transparent py-[3px] pr-2 text-[15px] leading-[22px] outline-none ${i.done ? "text-dim line-through" : ""}`} />
            </div>
          );
        })}
        {!rows.length && (
          <button type="button" onClick={addFirst} className="w-full px-3 py-3 text-left text-[14px] text-dim">{needle ? "Nothing matches." : "Tap here to start. Or paste a list (indented lines become nested bullets)."}</button>
        )}
        {rows.length > 0 && !needle && <button type="button" onClick={addFirst} className="ml-10 min-h-8 text-[13px] text-dim hover:text-accent">+ Add</button>}
      </div>
      <details className="text-[12px] text-dim">
        <summary className="cursor-pointer">Keyboard shortcuts</summary>
        <p className="mt-1 leading-relaxed">Enter: new bullet · Tab / Shift+Tab: indent / outdent · ↑ ↓: move between bullets · Ctrl/⌘+Enter: complete · Ctrl/⌘+↑ / ↓: collapse / expand · Ctrl/⌘+Shift+↑ / ↓: move a bullet up / down · Backspace on an empty bullet: delete it · Ctrl/⌘+Shift+Backspace: delete a bullet with everything under it · Click a bullet dot to zoom in. Paste an indented list (like a Workflowy export) to bring it all in at once.</p>
      </details>
      {/* On a phone (no Tab key): the tools for the bullet she's on. */}
      {act && actIdx >= 0 && (
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+64px)] z-20 flex justify-center gap-1 rounded-xl border border-border bg-[#141414]/95 p-1 backdrop-blur md:hidden">
          {[["⇤", "Outdent", () => outdent(act)], ["⇥", "Indent", () => indent(act)], ["↑", "Move up", () => move(act, -1)], ["↓", "Move down", () => move(act, 1)],
            ["✓", act.done ? "Not done" : "Complete", () => plan.patch(act.id, { done: !act.done })], ["🗑", "Delete", () => del(act, actIdx)]].map(([icon, label, fn]) => (
            <button key={label as string} type="button" onMouseDown={(e) => e.preventDefault()} onClick={fn as () => void} aria-label={label as string} className="min-h-10 min-w-10 rounded-lg px-2 text-[15px] text-[#d0d0d0] active:bg-[#262626]">{icon as string}</button>
          ))}
        </div>
      )}
    </div>
  );
}
