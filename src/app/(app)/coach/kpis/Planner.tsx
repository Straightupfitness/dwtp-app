"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Grip, useDnd } from "@/components/useDnd";
import { deleteItems, saveItems, type PlanItem } from "./items";

/**
 * November 19 (Michael): his planner on the KPIs tab. November 20: the Eisenhower matrix, where every box is an outline
 * that works like Workflowy, and a Projects box underneath. Drag bullets (with everything under them) from a project
 * into a box, or between boxes. Changes show right away and save a moment later.
 * Data: outline lines (kind "outline"); a top-level line's quadrant says which box it's in (1–4, or none = Projects).
 */

const uid = () => crypto.randomUUID();
const byPos = (a: PlanItem, b: PlanItem) => a.position - b.position;

/** All planner lines in one place, saved in the background. */
export function usePlan(initial: PlanItem[]) {
  // November 20: the Eisenhower matrix boxes became outlines too, so older matrix tasks become bullets in their box.
  const [items, setItems] = useState<PlanItem[]>(() => initial.map((i) => (i.kind === "matrix" ? { ...i, kind: "outline" as const, parent_id: null } : i)));
  const [status, setStatus] = useState<"" | "saving" | "saved" | string>("");
  const dirty = useRef(new Map<string, PlanItem>(initial.filter((i) => i.kind === "matrix").map((i) => [i.id, { ...i, kind: "outline" as const, parent_id: null }])));
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
  useEffect(() => { if (dirty.current.size) later(); }, [later]); // save the converted matrix tasks once
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

type Box = 1 | 2 | 3 | 4 | null; // null = Projects
const BOXES: { box: Box; title: string; sub: string; color: string }[] = [
  { box: 1, title: "Urgent & important", sub: "Do now", color: "#ef4444" },
  { box: 2, title: "Not urgent & important", sub: "Schedule", color: "#f5a623" },
  { box: 3, title: "Urgent, not important", sub: "Delegate", color: "#38bdf8" },
  { box: 4, title: "Not urgent, not important", sub: "Delete", color: "#8a8a8a" },
];
const PROJECTS = { box: null as Box, title: "Projects", sub: "Your big projects. Drag their tasks into the boxes above.", color: "#c084fc" };

/** The whole matrix: four boxes and Projects, each an outline, with drag and drop between them. */
export function Matrix({ plan }: { plan: Plan }) {
  const items = useMemo(() => plan.items.filter((i) => i.kind === "outline"), [plan.items]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const kids = useMemo(() => {
    const m = new Map<string, PlanItem[]>();
    for (const i of items) if (i.parent_id && byId.has(i.parent_id)) (m.get(i.parent_id) ?? m.set(i.parent_id, []).get(i.parent_id)!).push(i);
    for (const l of m.values()) l.sort(byPos);
    return m;
  }, [items, byId]);
  const roots = useCallback((box: Box) => items.filter((i) => !(i.parent_id && byId.has(i.parent_id)) && (i.quadrant ?? null) === box).sort(byPos), [items, byId]);
  /** Which box a line is in (its top-level line's box). */
  const boxOf = useCallback((i: PlanItem): Box => { let c = i; for (let n = 0; c.parent_id && byId.has(c.parent_id) && n < 60; n++) c = byId.get(c.parent_id)!; return (c.quadrant ?? null) as Box; }, [byId]);
  const [showDone, setShowDone] = useState(false);
  const [q, setQ] = useState("");

  // Drag a bullet (and everything under it) within a box or into another one.
  const dnd = useDnd((id, zone, before) => {
    const m = byId.get(id); if (!m) return;
    const box = (zone === "box-p" ? null : Number(zone.replace("box-", ""))) as Box;
    if (!before) { plan.put([{ ...m, parent_id: null, quadrant: box, position: posAt(roots(box), null, id) }]); return; }
    const t = byId.get(before); if (!t || t.id === id) return;
    for (let c: PlanItem | undefined = t; c; c = c.parent_id ? byId.get(c.parent_id) : undefined) if (c.id === id) return; // not into itself
    const parent = t.parent_id && byId.has(t.parent_id) ? t.parent_id : null;
    plan.put([{ ...m, parent_id: parent, quadrant: parent ? m.quadrant : box, position: posAt(parent ? kids.get(parent) ?? [] : roots(box), t.id, id) }]);
  });
  const setAll = (collapsed: boolean) => plan.put(items.filter((i) => (kids.get(i.id)?.length ?? 0) > 0 && i.collapsed !== collapsed).map((i) => ({ ...i, collapsed })));
  const shared = { plan, items, byId, kids, roots, boxOf, dnd, showDone, needle: q.trim().toLowerCase() };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search every box" aria-label="Search the matrix" className="min-h-10 min-w-[10rem] flex-1 rounded-xl border border-border bg-card px-3 text-[14px] outline-none focus:border-accent" />
        <button type="button" onClick={() => setShowDone((x) => !x)} className="min-h-10 rounded-xl border border-border px-3 text-[12px] text-dim">{showDone ? "Hide completed" : "Show completed"}</button>
        <button type="button" onClick={() => setAll(false)} className="min-h-10 rounded-xl border border-border px-3 text-[12px] text-dim">Expand all</button>
        <button type="button" onClick={() => setAll(true)} className="min-h-10 rounded-xl border border-border px-3 text-[12px] text-dim">Collapse all</button>
        <Saved s={plan.status} />
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {BOXES.map((b) => <OutlineBox key={b.box} {...b} {...shared} />)}
      </div>
      <OutlineBox {...PROJECTS} {...shared} />
      <details className="text-[12px] text-dim">
        <summary className="cursor-pointer">How it works (keyboard shortcuts)</summary>
        <p className="mt-1 leading-relaxed">Each box works like Workflowy. Drag a bullet by its dots into another box, or up and down, and everything under it comes along · Enter: new bullet · Tab / Shift+Tab: indent / outdent · ↑ ↓: move between bullets · Ctrl/⌘+Enter: complete · Ctrl/⌘+↑ / ↓: collapse / expand · Ctrl/⌘+Shift+↑ / ↓: move a bullet up / down · Backspace on an empty bullet: delete it · Ctrl/⌘+Shift+Backspace: delete a bullet with everything under it · Click a bullet dot to zoom in. Paste an indented list (like a Workflowy export) to bring it all in at once.</p>
      </details>
      {dnd.ghost}
    </div>
  );
}

type Shared = {
  plan: Plan; items: PlanItem[]; byId: Map<string, PlanItem>; kids: Map<string, PlanItem[]>; roots: (b: Box) => PlanItem[]; boxOf: (i: PlanItem) => Box;
  dnd: ReturnType<typeof useDnd>; showDone: boolean; needle: string;
};

/** One box of the matrix (or Projects): an outline that works like Workflowy. */
function OutlineBox({ box, title, sub, color, plan, byId, kids, roots, boxOf, dnd, showDone, needle }: { box: Box; title: string; sub: string; color: string } & Shared) {
  const [zoom, setZoom] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string; at?: number } | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const refs = useRef(new Map<string, HTMLTextAreaElement>());
  const zoomItem = zoom ? byId.get(zoom) : undefined;
  const root = zoomItem && boxOf(zoomItem) === box ? zoom : null; // a line dragged to another box leaves this box's zoom
  const childrenOf = useCallback((pid: string | null) => (pid ? kids.get(pid) ?? [] : roots(box)), [kids, roots, box]);

  // Search: what matches and the lines above it.
  const keep = useMemo(() => {
    if (!needle) return null;
    const s = new Set<string>();
    for (const i of byId.values()) if (boxOf(i) === box && (i.text.toLowerCase().includes(needle) || (i.note ?? "").toLowerCase().includes(needle))) {
      let c: PlanItem | undefined = i; while (c && !s.has(c.id)) { s.add(c.id); c = c.parent_id ? byId.get(c.parent_id) : undefined; }
    }
    return s;
  }, [needle, byId, boxOf, box]);
  const rows = useMemo(() => {
    const out: { i: PlanItem; depth: number }[] = [];
    const walk = (pid: string | null, depth: number) => {
      for (const i of childrenOf(pid)) {
        if (!showDone && i.done && !keep) continue;
        if (keep && !keep.has(i.id)) continue;
        out.push({ i, depth });
        if ((!i.collapsed || keep) && kids.get(i.id)?.length) walk(i.id, depth + 1);
      }
    };
    walk(root, 0);
    return out;
  }, [childrenOf, kids, root, showDone, keep]);

  useEffect(() => {
    if (!focus) return;
    const el = refs.current.get(focus.id);
    if (el) { el.focus(); const at = focus.at ?? el.value.length; el.setSelectionRange(at, at); setFocus(null); }
  }, [focus, rows]);

  const parentOf = (i: PlanItem) => (i.parent_id && byId.has(i.parent_id) ? i.parent_id : null);
  const siblings = (i: PlanItem) => childrenOf(parentOf(i));
  const newLine = (parent: string | null, position: number, text = ""): PlanItem => ({ id: uid(), kind: "outline", parent_id: parent, text, note: null, quadrant: parent ? null : box, position, done: false, collapsed: false });
  const after = (i: PlanItem) => { const s = siblings(i); const k = s.findIndex((x) => x.id === i.id); return s[k + 1] ? (i.position + s[k + 1].position) / 2 : i.position + 1; };

  function enter(i: PlanItem, el: HTMLTextAreaElement) {
    const a = el.selectionStart ?? i.text.length;
    const before = i.text.slice(0, a), rest = i.text.slice(a);
    const open = (kids.get(i.id)?.length ?? 0) > 0 && !i.collapsed;
    if (a === 0 && i.text) { // at the very start: a new empty line above
      const s = siblings(i); const k = s.findIndex((x) => x.id === i.id);
      const n = newLine(parentOf(i), k > 0 ? (s[k - 1].position + i.position) / 2 : i.position - 1);
      plan.put([n]); setFocus({ id: n.id }); return;
    }
    const n = open ? newLine(i.id, ((kids.get(i.id) ?? [])[0]?.position ?? 1) - 1, rest) : newLine(parentOf(i), after(i), rest);
    plan.put([{ ...i, text: before }, n]); setFocus({ id: n.id, at: 0 });
  }
  function indent(i: PlanItem) {
    const s = siblings(i); const k = s.findIndex((x) => x.id === i.id);
    if (k <= 0) return;
    const p = s[k - 1]; const last = (kids.get(p.id) ?? []).at(-1);
    plan.put([{ ...p, collapsed: false }, { ...i, parent_id: p.id, position: (last?.position ?? 0) + 1 }]); setFocus({ id: i.id });
  }
  function outdent(i: PlanItem) {
    const pid = parentOf(i);
    if (!pid || pid === root) return;
    const p = byId.get(pid)!;
    const gp = parentOf(p);
    plan.put([{ ...i, parent_id: gp, quadrant: gp ? i.quadrant : box, position: after(p) }]); setFocus({ id: i.id });
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
    const out: PlanItem[] = []; const stack: { depth: number; id: string; last: number }[] = [];
    let pos = i.text ? after(i) : i.position;
    let first = true;
    for (const l of lines) {
      while (stack.length && stack.at(-1)!.depth >= l.depth) stack.pop();
      const parent = stack.length ? stack.at(-1)!.id : parentOf(i);
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
  const addLine = () => { const n = newLine(root, (childrenOf(root).at(-1)?.position ?? 0) + 1); plan.put([n]); setFocus({ id: n.id }); };
  const act = active ? byId.get(active) : undefined;
  const actIdx = act ? rows.findIndex((r) => r.i.id === act.id) : -1;
  const zone = box === null ? "box-p" : `box-${box}`;

  return (
    <div data-drop={zone} className="flex min-h-40 flex-col rounded-xl border bg-card p-2.5 transition"
      style={{ borderColor: `${color}88`, ...(dnd.over === zone ? { boxShadow: `0 0 0 2px ${color}` } : {}) }}>
      <p className="text-[13px] font-semibold" style={{ color }}>{title}</p>
      <p className="text-[11px] uppercase tracking-[0.14em] text-dim">{sub}</p>
      {root && (
        <p className="mt-1 flex flex-wrap items-center gap-1 text-[12px]">
          <button type="button" onClick={() => setZoom(null)} className="text-accent underline">{title}</button>
          {crumbs.map((c, k) => <span key={c.id} className="flex items-center gap-1"><span className="text-dim">›</span>
            <button type="button" onClick={() => setZoom(c.id)} className={k === crumbs.length - 1 ? "max-w-[12rem] truncate font-semibold" : "max-w-[8rem] truncate text-accent underline"}>{c.text || "Untitled"}</button></span>)}
        </p>
      )}
      <div className="mt-1 flex-1">
        {rows.map(({ i, depth }, idx) => {
          const has = (kids.get(i.id)?.length ?? 0) > 0;
          return (
            <div key={i.id} data-before={i.id} {...dnd.bind(i.id, i.text || "Untitled")}
              className={`group flex items-start ${dnd.overBefore === i.id && dnd.dragging !== i.id ? "shadow-[inset_0_2px_0_var(--accent)]" : ""}`}
              style={{ paddingLeft: depth * 20, ...dnd.bind(i.id, "").style }}>
              <span className="flex h-7 items-center opacity-100 md:opacity-0 md:group-hover:opacity-100"><Grip /></span>
              <button type="button" onClick={() => has && plan.patch(i.id, { collapsed: !i.collapsed })} aria-label={has ? (i.collapsed ? "Expand" : "Collapse") : undefined} tabIndex={-1}
                className={`grid h-7 w-4 shrink-0 place-items-center text-[9px] text-dim ${has ? "opacity-60 hover:opacity-100 md:opacity-0 md:group-hover:opacity-100" : "invisible"}`}>{i.collapsed ? "▶" : "▼"}</button>
              <button type="button" onClick={() => setZoom(i.id)} aria-label={`Zoom into ${i.text || "this line"}`} tabIndex={-1} className="grid h-7 w-5 shrink-0 place-items-center">
                <span className={`block size-[7px] rounded-full ${i.done ? "bg-[#5a5a5a]" : "bg-[#d0d0d0]"} ${has && i.collapsed ? "outline outline-[5px] outline-[#3a3a3a]" : ""}`} />
              </button>
              <textarea ref={(el) => { if (el) { refs.current.set(i.id, el); el.style.height = "0px"; el.style.height = `${el.scrollHeight}px`; } else refs.current.delete(i.id); }}
                value={i.text} rows={1} onChange={(e) => plan.patch(i.id, { text: e.target.value.replace(/\n/g, " ") })}
                onKeyDown={(e) => key(e, i, idx)} onPaste={(e) => paste(i, e)} onFocus={() => setActive(i.id)}
                className={`min-h-7 flex-1 resize-none overflow-hidden bg-transparent py-[3px] pr-1 text-[14px] leading-[22px] outline-none ${i.done ? "text-dim line-through" : ""}`} />
            </div>
          );
        })}
        {!rows.length && <p className="py-1 text-[12px] text-dim">{needle ? "Nothing matches." : box === null ? "Add a project, or paste one in (indented lines become its tasks)." : "Nothing here. Add one, or drag one in."}</p>}
      </div>
      {!needle && <button type="button" onClick={addLine} className="mt-1 min-h-8 self-start rounded-lg px-2 text-[13px] text-dim hover:text-accent">+ Add</button>}
      {/* On a phone (no Tab key): the tools for the bullet she's on. */}
      {act && actIdx >= 0 && (
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+64px)] z-20 mt-1 flex justify-center gap-1 rounded-xl border border-border bg-[#141414]/95 p-1 backdrop-blur md:hidden">
          {([["⇤", "Outdent", () => outdent(act)], ["⇥", "Indent", () => indent(act)], ["↑", "Move up", () => move(act, -1)], ["↓", "Move down", () => move(act, 1)],
            ["✓", act.done ? "Not done" : "Complete", () => plan.patch(act.id, { done: !act.done })], ["🗑", "Delete", () => del(act, actIdx)]] as [string, string, () => void][]).map(([icon, label, fn]) => (
            <button key={label} type="button" onMouseDown={(e) => e.preventDefault()} onClick={fn} aria-label={label} className="min-h-10 min-w-10 rounded-lg px-2 text-[15px] text-[#d0d0d0] active:bg-[#262626]">{icon}</button>
          ))}
        </div>
      )}
    </div>
  );
}
