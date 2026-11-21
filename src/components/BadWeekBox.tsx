/**
 * November 20 (Michael): "Was this a bad week?" in plain words, so she knows exactly what ticking it does.
 * Used at the top of her check-in.
 */
export default function BadWeekBox({ already, left, checked, onChange }: { already: boolean; left: number; checked: boolean; onChange: (v: boolean) => void }) {
  const box = "rounded-[14px] border border-[#7c5cff]/60 bg-[#151024] p-3";
  if (already) return <p className={`${box} text-[14px] leading-snug`}><b>This week is a bad week.</b> It counts as done. Just tell me what happened.</p>;
  return (
    <label className={`${box} flex items-start gap-3`}>
      <input type="checkbox" checked={checked} disabled={!left} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[#7c5cff]" />
      <span className="text-[14px] leading-snug">
        <b className="block text-[15px]">Was this a bad week?</b>
        {left ? (
          <span className="mt-1 block text-[13px] text-[#cfcfcf]">
            If life got in the way, tick this:
            <span className="mt-1 block">✓ This week still counts as done for your 15 Pound Guarantee, even with missed habits.</span>
            <span className="block">✓ Nothing gets postponed. Next week&apos;s Habits &amp; Homework opens as usual.</span>
            <span className="block">✓ Your check-in gets shorter: just tell me what happened.</span>
            <span className="mt-1 block text-[12px] text-[#b9a6ff]">{left} of 3 bad weeks left</span>
          </span>
        ) : <span className="mt-1 block text-[13px] text-[#cfcfcf]">You&apos;ve used all 3 bad weeks. Message me and I&apos;ll help you through this one.</span>}
      </span>
    </label>
  );
}
