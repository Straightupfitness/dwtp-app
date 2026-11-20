"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDnd } from "@/components/useDnd";
import Section from "@/components/Section";
import { deleteEvent, deleteItems, saveEvent, saveItems, type CalEvent, type PlanItem } from "./items";

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
    const w = window as Window & { __dwtpPlannerSaving?: boolean };
    w.__dwtpPlannerSaving = true; // the app-wide Undo button ignores the planner's own saves
    const a = rows.length ? await saveItems(rows) : { ok: true as const };
    const b = del.length ? await deleteItems(del) : { ok: true as const };
    w.__dwtpPlannerSaving = false;
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

  // November 20 (Michael): undo and redo (⌘Z / ⇧⌘Z, or the buttons). Every change saves what came before; a run of
  // typing in one line counts as one step.
  const past = useRef<PlanItem[][]>([]);
  const future = useRef<PlanItem[][]>([]);
  const lastType = useRef<{ id: string; at: number } | null>(null);
  const [steps, setSteps] = useState({ undo: 0, redo: 0 });
  const record = useCallback((typingIn?: string) => {
    const now = Date.now();
    (window as Window & { __dwtpPlannerAt?: number }).__dwtpPlannerAt = now; // ⌘Z goes to whichever was changed last
    if (typingIn && lastType.current?.id === typingIn && now - lastType.current.at < 1500) { lastType.current.at = now; return; }
    lastType.current = typingIn ? { id: typingIn, at: now } : null;
    past.current.push(latest.current);
    if (past.current.length > 100) past.current.shift();
    future.current = [];
    setSteps({ undo: past.current.length, redo: 0 });
  }, []);
  /** Make the planner look exactly like `target` again, and save the difference. */
  const apply = useCallback((target: PlanItem[]) => {
    const cur = new Map(latest.current.map((i) => [i.id, i]));
    const next = new Map(target.map((i) => [i.id, i]));
    for (const t of target) { const c = cur.get(t.id); if (!c || JSON.stringify(c) !== JSON.stringify(t)) { dirty.current.set(t.id, t); gone.current.delete(t.id); } }
    for (const id of cur.keys()) if (!next.has(id)) { gone.current.add(id); dirty.current.delete(id); }
    latest.current = target;
    setItems(target);
    later();
  }, [later]);
  const undo = useCallback(() => {
    const prev = past.current.pop(); if (!prev) return;
    future.current.push(latest.current); lastType.current = null;
    apply(prev); setSteps({ undo: past.current.length, redo: future.current.length });
  }, [apply]);
  const redo = useCallback(() => {
    const next = future.current.pop(); if (!next) return;
    past.current.push(latest.current); lastType.current = null;
    apply(next); setSteps({ undo: past.current.length, redo: future.current.length });
  }, [apply]);

  const put = useCallback((rows: PlanItem[], typingIn?: string) => {
    record(typingIn);
    const m = new Map(latest.current.map((i) => [i.id, i]));
    for (const r of rows) { m.set(r.id, r); dirty.current.set(r.id, r); gone.current.delete(r.id); }
    latest.current = [...m.values()];
    setItems(latest.current);
    later();
  }, [later, record]);
  const patch = useCallback((id: string, p: Partial<PlanItem>) => {
    const cur = latest.current.find((i) => i.id === id);
    const onlyText = Object.keys(p).length === 1 && "text" in p;
    if (cur) put([{ ...cur, ...p }], onlyText ? id : undefined);
  }, [put]);
  const remove = useCallback((ids: string[]) => {
    record();
    // A line's children go with it.
    const all = new Set(ids);
    let grew = true;
    while (grew) { grew = false; for (const i of latest.current) if (i.parent_id && all.has(i.parent_id) && !all.has(i.id)) { all.add(i.id); grew = true; } }
    latest.current = latest.current.filter((i) => !all.has(i.id));
    setItems(latest.current);
    for (const id of all) { gone.current.add(id); dirty.current.delete(id); }
    later();
  }, [later, record]);
  return { items, put, patch, remove, status, undo, redo, canUndo: steps.undo > 0, canRedo: steps.redo > 0 };
}
type Plan = ReturnType<typeof usePlan>;

const Saved = ({ s }: { s: string }) => s ? <span className={`text-[11px] ${s === "saving" || s === "saved" ? "text-dim" : "text-[var(--red)]"}`}>{s === "saving" ? "Saving…" : s === "saved" ? "Saved" : s}</span> : null;


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
export function Matrix({ plan, events = [] }: { plan: Plan; events?: CalEvent[] }) {
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

  // November 20: several bullets can be picked (⇧ or ⌘-click their dots, or Select on a phone) and dragged together.
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [selMode, setSelMode] = useState(false);
  const picked = useCallback((id: string) => {
    if (!sel.has(id) || sel.size < 2) return [id];
    // In screen order, and not a bullet whose parent is also picked (it comes along anyway).
    const list = [...sel].map((x) => byId.get(x)).filter((x): x is PlanItem => !!x)
      .filter((x) => { for (let c = x.parent_id ? byId.get(x.parent_id) : undefined; c; c = c.parent_id ? byId.get(c.parent_id) : undefined) if (sel.has(c.id)) return false; return true; });
    const order = (x: PlanItem) => { const path: number[] = []; for (let c: PlanItem | undefined = x; c; c = c.parent_id ? byId.get(c.parent_id) : undefined) path.unshift(c.position); return path; };
    return list.sort((a, b) => { const pa = order(a), pb = order(b); for (let k = 0; k < Math.min(pa.length, pb.length); k++) if (pa[k] !== pb[k]) return pa[k] - pb[k]; return pa.length - pb.length; }).map((x) => x.id);
  }, [sel, byId]);

  // Drag bullets (and everything under them) within a box, into another one, or onto the scheduler.
  const dnd = useDnd((rawId, zone, before) => {
    const fromCal = rawId.startsWith("cal:");
    const id = fromCal ? rawId.slice(4) : rawId;
    const ids = fromCal ? [id] : picked(id);
    if (zone.startsWith("slot|")) { // onto a day and time: one after another, each keeping its length
      const [, day, mins] = zone.split("|");
      let at = new Date(`${day}T00:00:00`).getTime() + Number(mins) * 60_000;
      const rows: PlanItem[] = [];
      for (const x of ids) { const m = byId.get(x); if (!m) continue; const len = m.sched_minutes ?? 60; rows.push({ ...m, sched_at: new Date(at).toISOString(), sched_minutes: len }); at += len * 60_000; }
      plan.put(rows); return;
    }
    if (fromCal) return; // a block dropped off the scheduler stays where it was
    const box = (zone === "box-p" ? null : Number(zone.replace("box-", ""))) as Box;
    const t = before ? byId.get(before) : undefined;
    if (t && ids.includes(t.id)) return;
    for (const x of ids) for (let c: PlanItem | undefined = t; c; c = c.parent_id ? byId.get(c.parent_id) : undefined) if (c.id === x) return; // not into itself
    const parent = t?.parent_id && byId.has(t.parent_id) ? t.parent_id : null;
    const list = (t && parent ? kids.get(parent) ?? [] : roots(box)).filter((x) => !ids.includes(x.id));
    // Spread the moved bullets evenly between the bullet above the drop spot and the one they land in front of.
    const k = t ? list.findIndex((x) => x.id === t.id) : list.length;
    const lo = k > 0 ? list[k - 1].position : (list[0]?.position ?? 1) - ids.length - 1;
    const hi = k < list.length ? list[k].position : lo + ids.length + 1;
    plan.put(ids.map((x, n) => { const m = byId.get(x)!; return { ...m, parent_id: parent, quadrant: parent ? m.quadrant : box, position: lo + ((hi - lo) * (n + 1)) / (ids.length + 1) }; }));
  });
  // Esc lets go of the picked bullets; Delete / Backspace removes them (when not typing).
  useEffect(() => {
    if (!sel.size) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = (document.activeElement as HTMLElement | null)?.matches("input, textarea");
      if (e.key === "Escape") { setSel(new Set()); return; }
      if (!typing && (e.key === "Delete" || e.key === "Backspace")) { e.preventDefault(); plan.remove([...sel]); setSel(new Set()); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel, plan]);
  // ⌘Z / Ctrl+Z undoes the last step here (and ⇧⌘Z / Ctrl+Y redoes it), unless she's typing in some other box on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k !== "z" && k !== "y") return;
      const el = document.activeElement as HTMLElement | null;
      const typingElsewhere = el && el.matches("input, textarea, select, [contenteditable=true]") && !el.closest("[data-planner]");
      if (typingElsewhere) return;
      // Something else on the page changed more recently (a client moved to another slot…): the app-wide undo takes it.
      const w = window as Window & { __dwtpPlannerAt?: number; __dwtpServerAt?: number };
      if (!el?.closest("[data-planner]") && (w.__dwtpServerAt ?? 0) > (w.__dwtpPlannerAt ?? 0)) return;
      e.preventDefault();
      if (k === "y" || e.shiftKey) plan.redo(); else plan.undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [plan]);
  const setAll = (collapsed: boolean) => plan.put(items.filter((i) => (kids.get(i.id)?.length ?? 0) > 0 && i.collapsed !== collapsed).map((i) => ({ ...i, collapsed })));
  const shared = { plan, items, byId, kids, roots, boxOf, dnd, showDone, needle: q.trim().toLowerCase(), sel, setSel, selMode };

  return (
    <div data-planner className="space-y-4">
      <Section title="Calendar" icon="calendar" open><Scheduler plan={plan} items={items} dnd={dnd} events={events} /></Section>
      <Section title="Eisenhower matrix" icon="checkins" open>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={plan.undo} disabled={!plan.canUndo} title="Undo (⌘Z)" aria-label="Undo" className="min-h-10 rounded-xl border border-border px-3 text-[13px] disabled:opacity-35">↶ Undo</button>
        <button type="button" onClick={plan.redo} disabled={!plan.canRedo} title="Redo (⇧⌘Z)" aria-label="Redo" className="min-h-10 rounded-xl border border-border px-3 text-[13px] disabled:opacity-35">↷ Redo</button>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search every box" aria-label="Search the matrix" className="min-h-10 min-w-[10rem] flex-1 rounded-xl border border-border bg-card px-3 text-[14px] outline-none focus:border-accent" />
        <button type="button" onClick={() => setShowDone((x) => !x)} className="min-h-10 rounded-xl border border-border px-3 text-[12px] text-dim">{showDone ? "Hide completed" : "Show completed"}</button>
        <button type="button" onClick={() => setAll(false)} className="min-h-10 rounded-xl border border-border px-3 text-[12px] text-dim">Expand all</button>
        <button type="button" onClick={() => setAll(true)} className="min-h-10 rounded-xl border border-border px-3 text-[12px] text-dim">Collapse all</button>
        <button type="button" onClick={() => { setSelMode((x) => !x); setSel(new Set()); }} aria-pressed={selMode} className={`min-h-10 rounded-xl border px-3 text-[12px] ${selMode ? "border-accent text-accent" : "border-border text-dim"}`}>{selMode ? "Done picking" : "Pick several"}</button>
        <Saved s={plan.status} />
      </div>
      {sel.size > 0 && (
        <p className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/60 bg-[#1f1708] px-3 py-1.5 text-[13px]">
          <b>{sel.size} picked</b><span className="text-dim">Drag one of them to move them all, or onto a day.</span>
          <button type="button" onClick={() => { plan.remove([...sel]); setSel(new Set()); }} className="min-h-8 text-[var(--red)]">Delete</button>
          <button type="button" onClick={() => setSel(new Set())} className="min-h-8 text-dim underline">Clear</button>
        </p>
      )}

      <div className="grid gap-2 md:grid-cols-2">
        {BOXES.map((b) => <OutlineBox key={b.box} {...b} {...shared} />)}
      </div>
      <OutlineBox {...PROJECTS} {...shared} />
      <details className="text-[12px] text-dim">
        <summary className="cursor-pointer">How it works (keyboard shortcuts)</summary>
        <p className="mt-1 leading-relaxed">Each box works like Workflowy. Drag a bullet by its dot into another box, up or down, or onto a day and time in the scheduler; everything under it comes along · ⇧ or ⌘-click dots to pick several, then drag one to move them all (Esc lets go, Delete removes them) · Enter: new bullet · Tab / Shift+Tab: indent / outdent · ↑ ↓ (or → at the end of a line, ← at the start): move between bullets · Ctrl/⌘+Enter: complete · Ctrl/⌘+↑ / ↓: collapse / expand · Ctrl/⌘+Shift+↑ / ↓: move a bullet up / down · Backspace on an empty bullet: delete it · Ctrl/⌘+Shift+Backspace: delete a bullet with everything under it · ⌘Z / Ctrl+Z: undo · ⇧⌘Z / Ctrl+Y: redo · Click a bullet&apos;s dot to zoom in. Paste an indented list (like a Workflowy export) to bring it all in at once.</p>
      </details>
      </Section>
      {dnd.ghost}
    </div>
  );
}

type Shared = {
  plan: Plan; items: PlanItem[]; byId: Map<string, PlanItem>; kids: Map<string, PlanItem[]>; roots: (b: Box) => PlanItem[]; boxOf: (i: PlanItem) => Box;
  dnd: ReturnType<typeof useDnd>; showDone: boolean; needle: string;
  sel: Set<string>; setSel: (s: Set<string>) => void; selMode: boolean;
};

/** One box of the matrix (or Projects): an outline that works like Workflowy. */
function OutlineBox({ box, title, sub, color, plan, byId, kids, roots, boxOf, dnd, showDone, needle, sel, setSel, selMode }: { box: Box; title: string; sub: string; color: string } & Shared) {
  const lastPick = useRef<string | null>(null);
  const [shut, setShut] = useState(false);
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
    // November 20: → at the end of a line goes to the start of the next one; ← at the start goes to the end of the last one.
    if (e.key === "ArrowRight" && !e.shiftKey && el.selectionStart === el.selectionEnd && el.selectionEnd === el.value.length) {
      const n = rows[idx + 1]; if (n) { e.preventDefault(); setFocus({ id: n.i.id, at: 0 }); } return;
    }
    if (e.key === "ArrowLeft" && !e.shiftKey && el.selectionStart === el.selectionEnd && el.selectionStart === 0) {
      const p = rows[idx - 1]; if (p) { e.preventDefault(); setFocus({ id: p.i.id }); } return;
    }
  }
  const crumbs: PlanItem[] = [];
  for (let c = root ? byId.get(root) : undefined; c; c = c.parent_id ? byId.get(c.parent_id) : undefined) crumbs.unshift(c);
  const addLine = () => { const n = newLine(root, (childrenOf(root).at(-1)?.position ?? 0) + 1); plan.put([n]); setFocus({ id: n.id }); };
  const act = active ? byId.get(active) : undefined;
  const actIdx = act ? rows.findIndex((r) => r.i.id === act.id) : -1;
  const zone = box === null ? "box-p" : `box-${box}`;

  return (
    <div data-drop={zone} className={`flex flex-col rounded-xl border bg-card p-2.5 transition ${shut ? "" : "min-h-40"}`}
      style={{ borderColor: `${color}88`, ...(dnd.over === zone ? { boxShadow: `0 0 0 2px ${color}` } : {}) }}>
      {/* November 20: each box opens and closes (a closed box still takes drops); titles in the display font. */}
      <button type="button" onClick={() => setShut((x) => !x)} aria-expanded={!shut} className="flex w-full items-center gap-1.5 text-left">
        <span className="font-[family-name:var(--font-display)] text-[15px] uppercase leading-tight tracking-[0.02em]" style={{ color }}>{title}</span>
        <span className={`text-dim transition ${shut ? "" : "rotate-180"}`}>⌄</span>
        <span className="ml-auto text-[11px] text-dim">{shut ? `${childrenOf(null).length}` : ""}</span>
      </button>
      <p className="text-[11px] uppercase tracking-[0.14em] text-dim">{sub}</p>
      {!shut && root && (
        <p className="mt-1 flex flex-wrap items-center gap-1 text-[12px]">
          <button type="button" onClick={() => setZoom(null)} className="text-accent underline">{title}</button>
          {crumbs.map((c, k) => <span key={c.id} className="flex items-center gap-1"><span className="text-dim">›</span>
            <button type="button" onClick={() => setZoom(c.id)} className={k === crumbs.length - 1 ? "max-w-[12rem] truncate font-semibold" : "max-w-[8rem] truncate text-accent underline"}>{c.text || "Untitled"}</button></span>)}
        </p>
      )}
      {!shut && <div className="mt-1 flex-1">
        {rows.map(({ i, depth }, idx) => {
          const has = (kids.get(i.id)?.length ?? 0) > 0;
          return (
            <div key={i.id} data-before={i.id} {...dnd.bind(i.id, sel.has(i.id) && sel.size > 1 ? `${sel.size} bullets` : i.text || "Untitled")}
              className={`group flex items-start rounded-md ${sel.has(i.id) ? "bg-accent/15" : ""} ${dnd.overBefore === i.id && dnd.dragging !== i.id ? "shadow-[inset_0_2px_0_var(--accent)]" : ""}`}
              style={{ paddingLeft: depth * 20, ...(dnd.dragging && (dnd.dragging === i.id || (sel.has(dnd.dragging) && sel.has(i.id))) ? { opacity: 0.35 } : {}) }}>
              <button type="button" onClick={() => has && plan.patch(i.id, { collapsed: !i.collapsed })} aria-label={has ? (i.collapsed ? "Expand" : "Collapse") : undefined} tabIndex={-1}
                className={`grid h-7 w-4 shrink-0 place-items-center text-[9px] text-dim ${has ? "opacity-60 hover:opacity-100 md:opacity-0 md:group-hover:opacity-100" : "invisible"}`}>{i.collapsed ? "▶" : "▼"}</button>
              {/* November 20: the dot is the handle: drag it to move the bullet (and what's under it); click it to zoom in;
                  ⇧ or ⌘-click (or Pick several) to pick it. */}
              <button type="button" data-grip tabIndex={-1} title="Drag to move · click to zoom in · ⇧ or ⌘-click to pick"
                aria-label={`Move or zoom into ${i.text || "this line"}`}
                onClick={(e) => {
                  if (e.shiftKey && lastPick.current) { // a range, on screen in this box
                    const a = rows.findIndex((r) => r.i.id === lastPick.current), b = rows.findIndex((r) => r.i.id === i.id);
                    if (a >= 0) { const n = new Set(sel); for (let k = Math.min(a, b); k <= Math.max(a, b); k++) n.add(rows[k].i.id); setSel(n); return; }
                  }
                  if (e.shiftKey || e.metaKey || e.ctrlKey || selMode) { const n = new Set(sel); if (n.has(i.id)) n.delete(i.id); else n.add(i.id); setSel(n); lastPick.current = i.id; return; }
                  setZoom(i.id);
                }}
                className="grid h-7 w-6 shrink-0 cursor-grab touch-none place-items-center">
                <span className={`block size-[8px] rounded-full transition group-hover:scale-125 ${sel.has(i.id) ? "bg-accent" : i.done ? "bg-[#5a5a5a]" : "bg-[#d0d0d0]"} ${has && i.collapsed ? "outline outline-[5px] outline-[#3a3a3a]" : ""}`} />
              </button>
              <textarea ref={(el) => { if (el) { refs.current.set(i.id, el); el.style.height = "0px"; el.style.height = `${el.scrollHeight}px`; } else refs.current.delete(i.id); }}
                value={i.text} rows={1} onChange={(e) => plan.patch(i.id, { text: e.target.value.replace(/\n/g, " ") })}
                onKeyDown={(e) => key(e, i, idx)} onPaste={(e) => paste(i, e)} onFocus={() => setActive(i.id)}
                className={`min-h-7 flex-1 resize-none overflow-hidden bg-transparent py-[3px] pr-1 text-[14px] leading-[22px] outline-none ${i.done ? "text-dim line-through" : ""}`} />
              {i.sched_at && <span className="mt-1 shrink-0 rounded bg-accent/15 px-1.5 text-[10.5px] leading-5 text-accent" title="On your schedule">
                {new Date(i.sched_at).toLocaleDateString("en-US", { weekday: "short" })} {new Date(i.sched_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(":00", "").replace(" ", "").toLowerCase()}</span>}
            </div>
          );
        })}
        {!rows.length && <p className="py-1 text-[12px] text-dim">{needle ? "Nothing matches." : box === null ? "Add a project, or paste one in (indented lines become its tasks)." : "Nothing here. Add one, or drag one in."}</p>}
      </div>}
      {!shut && !needle && <button type="button" onClick={addLine} className="mt-1 min-h-8 self-start rounded-lg px-2 text-[13px] text-dim hover:text-accent">+ Add</button>}
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

// ── Scheduler ───────────────────────────────────────────────

const HOUR_PX = 34, FIRST = 5, LAST = 21; // 5 AM to 9 PM (the last row runs to 10)
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
const timeLabel = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(":00", "");

/**
 * November 20 (Michael): a week (today first) from 5 AM to 9 PM. Drag a task from the matrix onto a day and time; drag a
 * block to move it; tap it to change how long it is, finish it, or take it off. The task stays in its box too.
 */
function Scheduler({ plan, items, dnd, events }: { plan: Plan; items: PlanItem[]; dnd: ReturnType<typeof useDnd>; events: CalEvent[] }) {
  const [evs, setEvs] = useState(events);
  const [seenEvents, setSeenEvents] = useState(events);
  if (seenEvents !== events) { setSeenEvents(events); setEvs(events); }
  const [openEv, setOpenEv] = useState<CalEvent | null>(null);
  // November 20: what comes back on a day: his weekly schedule and the year's birthdays.
  const repeatsOn = (d: Date) => evs.filter((e) => (e.kind === "weekly" ? e.weekday === d.getDay() : e.month === d.getMonth() + 1 && e.day === d.getDate()));
  const [offset, setOffset] = useState(0); // days from today
  const [open, setOpen] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, []);
  const days = Array.from({ length: 7 }, (_, k) => { const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + offset + k); return d; });
  const today = ymd(now);
  const blocks = items.filter((i) => i.sched_at);
  const height = (LAST - FIRST + 1) * HOUR_PX;
  // A day's timed things: scheduled tasks and the weekly schedule, side by side when they overlap.
  type Slot = { key: string; start: number; len: number; i?: PlanItem; e?: CalEvent };
  const of = (day: string, date: Date) => {
    const tasks: Slot[] = blocks.map((i) => { const at = new Date(i.sched_at!); return { key: i.id, i, day: ymd(at), start: at.getHours() * 60 + at.getMinutes(), len: i.sched_minutes ?? 60 }; })
      .filter((b) => b.day === day);
    const reps: Slot[] = repeatsOn(date).filter((e) => e.start_min !== null).map((e) => ({ key: `e-${e.id}`, e, start: e.start_min!, len: e.minutes }));
    const list = [...reps, ...tasks].sort((a, b) => a.start - b.start || b.len - a.len);
    const lanes: number[] = []; const placed = list.map((b) => { let lane = lanes.findIndex((end) => end <= b.start); if (lane < 0) { lane = lanes.length; lanes.push(0); } lanes[lane] = b.start + b.len; return { ...b, lane }; });
    return placed.map((b) => ({ ...b, lanes: Math.max(1, ...placed.filter((o) => o.start < b.start + b.len && b.start < o.start + o.len).map((o) => o.lane + 1)) }));
  };
  const openItem = open ? items.find((i) => i.id === open) : undefined;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[12px] text-dim">Drag a task from the matrix onto a day and time.</p>
        <span className="flex gap-1">
          <button type="button" onClick={() => setOffset((x) => x - 7)} className="min-h-8 rounded-lg border border-border px-2.5 text-[13px]" aria-label="Previous week">‹</button>
          <button type="button" onClick={() => setOffset(0)} disabled={offset === 0} className="min-h-8 rounded-lg border border-border px-2.5 text-[12px] disabled:opacity-40">Today</button>
          <button type="button" onClick={() => setOffset((x) => x + 7)} className="min-h-8 rounded-lg border border-border px-2.5 text-[13px]" aria-label="Next week">›</button>
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[44rem]" style={{ gridTemplateColumns: "3rem repeat(7, minmax(0, 1fr))" }}>
          <div />
          {days.map((d) => (
            <p key={ymd(d)} className={`pb-1 text-center text-[12px] ${ymd(d) === today ? "font-semibold text-accent" : "text-dim"}`}>
              {ymd(d) === today ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" })} {d.getDate()}
            </p>
          ))}
          {/* All-day: check-in replies, birthdays… */}
          <p className="pt-0.5 text-right text-[9px] uppercase tracking-wide text-dim">all day</p>
          {days.map((d) => (
            <div key={`ad-${ymd(d)}`} className="space-y-0.5 border-l border-border px-0.5 pb-1">
              {repeatsOn(d).filter((e) => e.start_min === null).map((e) => (
                <button key={e.id} type="button" onClick={() => setOpenEv(e)} title={e.note ?? e.title}
                  className={`block w-full truncate rounded px-1 text-left text-[10px] leading-4 ${e.kind === "yearly" ? "bg-[#3a1d2e] text-[#ffb3d1]" : "bg-[#13222e] text-[#9bdcff]"}`}>{e.icon ? `${e.icon} ` : ""}{e.title}</button>
              ))}
            </div>
          ))}
          {/* The hours down the side */}
          <div className="relative" style={{ height }}>
            {Array.from({ length: LAST - FIRST + 1 }, (_, k) => <span key={k} className="absolute right-1 -translate-y-1/2 text-[10px] text-dim" style={{ top: k * HOUR_PX + (k ? 0 : 6) }}>{hourLabel(FIRST + k)}</span>)}
          </div>
          {days.map((d) => {
            const day = ymd(d);
            return (
              <div key={day} className="relative border-l border-border" style={{ height }}>
                {/* Half-hour spots to drop on */}
                {Array.from({ length: (LAST - FIRST + 1) * 2 }, (_, k) => {
                  const mins = FIRST * 60 + k * 30, zone = `slot|${day}|${mins}`;
                  return <div key={k} data-drop={zone} className={`absolute inset-x-0 ${k % 2 ? "border-b border-border/70" : "border-b border-dashed border-border/30"} ${dnd.over === zone ? "bg-accent/25" : ""}`} style={{ top: k * (HOUR_PX / 2), height: HOUR_PX / 2 }} />;
                })}
                {day === today && now.getHours() >= FIRST && now.getHours() <= LAST && (
                  <div className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-[#ef4444]" style={{ top: ((now.getHours() - FIRST) * 60 + now.getMinutes()) / 60 * HOUR_PX }} />
                )}
                {of(day, d).map(({ key, i, e, start, len, lane, lanes }) => {
                  const top = Math.max(0, (start - FIRST * 60) / 60 * HOUR_PX), h = Math.max(16, len / 60 * HOUR_PX - 2);
                  const pos = { top, height: h, left: `calc(${(lane / lanes) * 100}% + 1px)`, width: `calc(${100 / lanes}% - 2px)` };
                  if (e) { // the weekly schedule: tap to see or change it
                    const at = new Date(d); at.setHours(0, e.start_min!, 0, 0);
                    return (
                      <button key={key} type="button" onClick={() => setOpenEv(e)} title={`${timeLabel(at)} · ${e.title}`}
                        className="absolute z-[15] overflow-hidden rounded-md border border-[#38bdf8]/50 bg-[#10202b] px-1 py-0.5 text-left text-[10px] leading-tight text-[#cfeaff]" style={pos}>
                        <span className="block text-[9px] text-[#7cc9f0]">{timeLabel(at)}</span><span className="line-clamp-2">{e.title}</span>
                      </button>
                    );
                  }
                  if (!i) return null;
                  return (
                    <button key={i.id} type="button" data-grip {...dnd.bind(`cal:${i.id}`, i.text || "Untitled")} onClick={() => setOpen(i.id)}
                      title={`${timeLabel(new Date(i.sched_at!))} · ${i.text}`}
                      className={`absolute z-20 touch-none overflow-hidden rounded-md border border-accent/70 bg-[#2a1f0c] px-1 py-0.5 text-left text-[10.5px] leading-tight text-text ${i.done ? "opacity-50 line-through" : ""}`}
                      style={pos}>
                      <span className="block text-[9px] text-accent">{timeLabel(new Date(i.sched_at!))}</span>
                      <span className="line-clamp-3">{i.text || "Untitled"}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <Repeats evs={evs} setEvs={setEvs} open={openEv} setOpen={setOpenEv} />
      {openItem && openItem.sched_at && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={() => setOpen(null)} role="dialog" aria-modal="true" aria-label="Scheduled task">
          <div className="w-full max-w-sm space-y-2.5 rounded-[18px] border border-border bg-[#121212] p-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-[15px] font-semibold">{openItem.text || "Untitled"}</p>
            <p className="text-[12px] text-dim">{new Date(openItem.sched_at).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} · {timeLabel(new Date(openItem.sched_at))}</p>
            <div className="flex flex-wrap gap-1.5">
              {[15, 30, 45, 60, 90, 120, 180].map((m) => (
                <button key={m} type="button" onClick={() => plan.patch(openItem.id, { sched_minutes: m })} aria-pressed={(openItem.sched_minutes ?? 60) === m}
                  className={`min-h-9 rounded-lg border px-2.5 text-[13px] ${(openItem.sched_minutes ?? 60) === m ? "border-accent font-semibold text-accent" : "border-border"}`}>{m < 60 ? `${m} min` : `${m / 60} h`}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => plan.patch(openItem.id, { done: !openItem.done })} className="min-h-10 flex-1 rounded-xl border border-border text-[13px] font-semibold">{openItem.done ? "Not done" : "✓ Done"}</button>
              <button type="button" onClick={() => { plan.patch(openItem.id, { sched_at: null }); setOpen(null); }} className="min-h-10 flex-1 rounded-xl border border-border text-[13px] text-[var(--red)]">Take off the calendar</button>
            </div>
            <button type="button" onClick={() => setOpen(null)} className="min-h-10 w-full rounded-xl bg-accent text-[14px] font-semibold text-black">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const minLabel = (m: number | null) => { if (m === null) return "All day"; const d = new Date(2000, 0, 1, 0, m); return timeLabel(d); };
const toTime = (m: number | null) => (m === null ? "" : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
const fromTime = (t: string) => { const m = t.match(/^(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

/**
 * November 20: his weekly schedule and the year's birthdays, listed under the calendar: add, change or remove them.
 * Birthdays send him a reminder 2 days before.
 */
function Repeats({ evs, setEvs, open, setOpen }: { evs: CalEvent[]; setEvs: (e: CalEvent[]) => void; open: CalEvent | null; setOpen: (e: CalEvent | null) => void }) {
  const [form, setForm] = useState<(Omit<CalEvent, "id"> & { id: string | null }) | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const blank = (kind: "weekly" | "yearly"): Omit<CalEvent, "id"> & { id: string | null } => ({ id: null, title: "", kind, weekday: 1, month: 1, day: 1, start_min: kind === "weekly" ? 540 : null, minutes: 60, icon: kind === "yearly" ? "🎂" : null, note: null });
  const edit = (e: CalEvent) => { setForm({ ...e }); setErr(""); setOpen(null); };
  const save = async () => {
    if (!form) return;
    setBusy(true); setErr("");
    const { id, ...rest } = form;
    const r = await saveEvent(id, rest);
    setBusy(false);
    if ("error" in r && r.error) { setErr(r.error); return; }
    const newId = "id" in r && r.id ? r.id : `new-${evs.length}`;
    setEvs(id ? evs.map((x) => (x.id === id ? { ...x, ...rest } : x)) : [...evs, { ...rest, id: newId }]);
    setForm(null);
  };
  const remove = async (e: CalEvent) => { const r = await deleteEvent(e.id); if (!("error" in r && r.error)) { setEvs(evs.filter((x) => x.id !== e.id)); setForm(null); setOpen(null); } };
  const weekly = evs.filter((e) => e.kind === "weekly").sort((a, b) => ((a.weekday ?? 0) + 6) % 7 - ((b.weekday ?? 0) + 6) % 7 || (a.start_min ?? -1) - (b.start_min ?? -1));
  const yearly = evs.filter((e) => e.kind === "yearly").sort((a, b) => (a.month ?? 0) - (b.month ?? 0) || (a.day ?? 0) - (b.day ?? 0));
  const box = "min-h-10 rounded-lg border border-border bg-bg px-2 text-[14px] text-text outline-none focus:border-accent";
  return (
    <>
      <details className="mt-2 text-[13px]">
        <summary className="cursor-pointer text-dim">Weekly schedule &amp; birthdays ({weekly.length} weekly · {yearly.length} yearly) · edit</summary>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          <div>
            <p className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-accent">Every week <button type="button" onClick={() => setForm(blank("weekly"))} className="normal-case tracking-normal text-accent underline">+ Add</button></p>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {weekly.map((e) => <li key={e.id}><button type="button" onClick={() => edit(e)} className="flex w-full gap-2 px-2 py-1 text-left hover:bg-[#161616]"><span className="w-9 shrink-0 text-dim">{WEEKDAYS[e.weekday ?? 0]}</span><span className="w-16 shrink-0 text-dim">{minLabel(e.start_min)}</span><span className="truncate">{e.title}</span></button></li>)}
            </ul>
          </div>
          <div>
            <p className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-accent">Every year (reminder 2 days before) <button type="button" onClick={() => setForm(blank("yearly"))} className="normal-case tracking-normal text-accent underline">+ Add</button></p>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {yearly.map((e) => <li key={e.id}><button type="button" onClick={() => edit(e)} className="flex w-full gap-2 px-2 py-1 text-left hover:bg-[#161616]"><span className="w-14 shrink-0 text-dim">{MONTHS[(e.month ?? 1) - 1]} {e.day}</span><span className="truncate">{e.icon ? `${e.icon} ` : ""}{e.title}{e.note ? <span className="text-dim"> · {e.note}</span> : null}</span></button></li>)}
            </ul>
          </div>
        </div>
      </details>
      {open && !form && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={() => setOpen(null)} role="dialog" aria-modal="true" aria-label={open.title}>
          <div className="w-full max-w-sm space-y-2 rounded-[18px] border border-border bg-[#121212] p-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-[16px] font-semibold">{open.icon ? `${open.icon} ` : ""}{open.title}</p>
            <p className="text-[13px] text-dim">{open.kind === "weekly" ? `Every ${WEEKDAYS[open.weekday ?? 0]} · ${minLabel(open.start_min)}${open.start_min !== null ? ` · ${open.minutes} min` : ""}` : `Every year on ${MONTHS[(open.month ?? 1) - 1]} ${open.day} · reminder 2 days before`}</p>
            {open.note && <p className="text-[14px]">{open.note}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => edit(open)} className="min-h-10 flex-1 rounded-xl border border-border text-[13px] font-semibold">Change</button>
              <button type="button" onClick={() => setOpen(null)} className="min-h-10 flex-1 rounded-xl bg-accent text-[13px] font-semibold text-black">Close</button>
            </div>
          </div>
        </div>
      )}
      {form && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={() => setForm(null)} role="dialog" aria-modal="true" aria-label="Repeating event">
          <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); void save(); }} className="w-full max-w-sm space-y-2.5 rounded-[18px] border border-border bg-[#121212] p-4">
            <p className="font-[family-name:var(--font-display)] text-lg uppercase">{form.id ? "Change" : "Add"} {form.kind === "weekly" ? "a weekly event" : "a yearly date"}</p>
            <input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={form.kind === "weekly" ? "Train at HG" : "Name"} className={`${box} w-full`} />
            {form.kind === "weekly" ? (
              <div className="flex flex-wrap gap-1">{WEEKDAYS.map((w, k) => <button key={w} type="button" onClick={() => setForm({ ...form, weekday: k })} className={`min-h-9 rounded-lg border px-2.5 text-[13px] ${form.weekday === k ? "border-accent text-accent" : "border-border text-dim"}`}>{w}</button>)}</div>
            ) : (
              <div className="flex gap-2">
                <select value={form.month ?? 1} onChange={(e) => setForm({ ...form, month: Number(e.target.value) })} className={box}>{MONTHS.map((m, k) => <option key={m} value={k + 1}>{m}</option>)}</select>
                <input type="number" min={1} max={31} value={form.day ?? 1} onChange={(e) => setForm({ ...form, day: Number(e.target.value) })} className={`${box} w-20`} />
                <input value={form.icon ?? ""} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="🎂" className={`${box} w-16 text-center`} aria-label="Icon" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-[13px] text-dim"><input type="checkbox" checked={form.start_min === null} onChange={(e) => setForm({ ...form, start_min: e.target.checked ? null : 540 })} className="size-4 accent-[var(--accent)]" />All day</label>
              {form.start_min !== null && <>
                <input type="time" value={toTime(form.start_min)} onChange={(e) => setForm({ ...form, start_min: fromTime(e.target.value) })} className={`${box} [color-scheme:dark]`} />
                <select value={form.minutes} onChange={(e) => setForm({ ...form, minutes: Number(e.target.value) })} className={box}>{[15, 30, 45, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} h`}</option>)}</select>
              </>}
            </div>
            <input value={form.note ?? ""} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Note (optional)" className={`${box} w-full`} />
            {err && <p className="text-[13px] text-[var(--red)]">{err}</p>}
            <button disabled={busy} className="min-h-11 w-full rounded-xl bg-accent font-semibold text-black disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
            {form.id && <button type="button" onClick={() => void remove(form as CalEvent)} className="min-h-10 w-full text-[13px] text-[var(--red)]">Delete</button>}
          </form>
        </div>
      )}
    </>
  );
}
