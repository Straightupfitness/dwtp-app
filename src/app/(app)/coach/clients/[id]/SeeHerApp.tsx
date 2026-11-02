"use client";

/** Opens her app, exactly as she sees it, in a phone-sized window (November 2). Look-only. */
export default function SeeHerApp({ clientId }: { clientId: string }) {
  return (
    <a href={`/coach/view-as/${clientId}`} target="dwtp-her-app"
      onClick={(e) => {
        const w = window.open(`/coach/view-as/${clientId}`, "dwtp-her-app", "popup,width=430,height=900");
        if (w) { e.preventDefault(); w.focus(); }
      }}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#7c3aed] px-3 text-[13px] font-semibold text-[#c4b5fd]">
      👀 See her app
    </a>
  );
}
