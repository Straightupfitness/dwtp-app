"use client";
import { useState, useTransition } from "react";
import { linksToText, type FaqItem, type FaqSection } from "@/lib/faq";
import { deleteItem, deleteSection, saveItem, saveSection } from "./actions";

const input = "mt-1 block w-full rounded-lg border border-[#2a2a2a] bg-bg px-3 py-2 text-base text-text outline-none focus:border-accent";

export function ItemEditor({ item, sectionId, kind, onDone }: { item?: FaqItem; sectionId: string; kind: "qa" | "list"; onDone?: () => void }) {
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const [ask, setAsk] = useState(false);
  return (
    <form action={(f) => start(async () => { const r = await saveItem(f); setMsg(r?.error ?? "Saved."); if (!r?.error) onDone?.(); })} className="space-y-2.5">
      <input type="hidden" name="id" value={item?.id ?? ""} /><input type="hidden" name="section_id" value={sectionId} /><input type="hidden" name="kind" value={item?.kind ?? kind} />
      <label className="block text-xs text-dim">{(item?.kind ?? kind) === "qa" ? "Question" : "List title"}<input name="title" defaultValue={item?.title} required className={input} /></label>
      <label className="block text-xs text-dim">{(item?.kind ?? kind) === "qa" ? "Short written answer" : "Note under the title (optional)"}
        <textarea name="body" rows={(item?.kind ?? kind) === "qa" ? 4 : 2} defaultValue={item?.body ?? ""} className={input} /></label>
      {(item?.kind ?? kind) === "qa" ? (
        <label className="block text-xs text-dim">Video link (YouTube unlisted, Vimeo, Bunny, Loom…)<input name="video_url" type="url" defaultValue={item?.video_url ?? ""} placeholder="https://" className={input} /></label>
      ) : (
        <label className="block text-xs text-dim">One item per line: <b className="text-text">Name | note | buy link</b>
          <textarea name="links" rows={8} defaultValue={linksToText(item?.links ?? [])} placeholder={"Magnesium glycinate | 300 mg before bed | https://amzn.to/…"} className={`${input} font-mono text-sm`} />
        </label>
      )}
      <label className="block w-24 text-xs text-dim">Order<input name="sort" type="number" defaultValue={item?.sort ?? 0} className={input} /></label>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="min-h-11 rounded-lg bg-accent px-5 font-semibold text-black disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
        {item && <button type="button" onClick={() => (ask ? start(() => deleteItem(item.id)) : setAsk(true))} className="min-h-11 text-sm text-[var(--red)]">{ask ? "Tap to delete" : "Delete"}</button>}
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </form>
  );
}

export function SectionEditor({ section }: { section?: FaqSection }) {
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const [ask, setAsk] = useState(false);
  return (
    <form action={(f) => start(async () => { const r = await saveSection(f); setMsg(r?.error ?? "Saved."); })} className="space-y-2.5">
      <input type="hidden" name="id" value={section?.id ?? ""} />
      <div className="grid grid-cols-[1fr_5rem] gap-2">
        <label className="text-xs text-dim">Section title<input name="title" defaultValue={section?.title} required className={input} /></label>
        <label className="text-xs text-dim">Order<input name="sort" type="number" defaultValue={section?.sort ?? 0} className={input} /></label>
      </div>
      <label className="block text-xs text-dim">Intro line<input name="intro" defaultValue={section?.intro ?? ""} className={input} /></label>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="min-h-11 rounded-lg border border-accent px-4 text-sm font-semibold text-accent disabled:opacity-50">{section ? "Save section" : "Add section"}</button>
        {section && <button type="button" onClick={() => (ask ? start(() => deleteSection(section.id)) : setAsk(true))} className="min-h-11 text-sm text-[var(--red)]">{ask ? "Tap to delete section and everything in it" : "Delete section"}</button>}
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </form>
  );
}
