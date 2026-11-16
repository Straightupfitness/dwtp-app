/**
 * November 15 (Michael): one look for the sections on a client's page: the same title style as "Weight" and
 * "Badges", in a card, collapsible (tap the title).
 */
export default function Section({ title, right, open = true, id, children }: { title: React.ReactNode; right?: React.ReactNode; open?: boolean; id?: string; children: React.ReactNode }) {
  return (
    <details id={id} open={open} className="group scroll-mt-20 rounded-[18px] border border-border bg-card p-4">
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-2 font-[family-name:var(--font-display)] text-lg uppercase">
        <span>{title} <span className="inline-block text-dim transition group-open:rotate-180">⌄</span></span>
        {right && <span className="font-sans text-[12px] normal-case text-dim">{right}</span>}
      </summary>
      <div className="mt-3 space-y-2">{children}</div>
    </details>
  );
}
