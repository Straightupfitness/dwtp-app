
/**
 * November 22: a bonus-course video. YouTube and Wistia play as embeds (they're hosted there, not on Xperiencify);
 * "code:BC-01" is a video Michael uploaded in Coach → Videos (shown with its captions).
 */
export default function BonusVideo({ v, videos }: { v: string; videos: Map<string, { url: string; portrait?: boolean }> }) {
  const box = "w-full overflow-hidden rounded-2xl border border-border bg-black";
  const yt = v.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  if (yt) return <div className={`${box} aspect-video`}><iframe src={`https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0&modestbranding=1&playsinline=1`} title="Video" className="size-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen loading="lazy" /></div>;
  const wi = v.match(/wistia\.com\/medias\/(\w+)/);
  if (wi) return <div className={`${box} aspect-video`}><iframe src={`https://fast.wistia.net/embed/iframe/${wi[1]}?playsinline=1`} title="Video" className="size-full" allow="autoplay; fullscreen" allowFullScreen loading="lazy" /></div>;
  const code = v.startsWith("code:") ? v.slice(5) : null;
  const own = code ? videos.get(code) : null;
  if (own) return (
    // These workout videos already have captions burned into the picture, so no captions track on top.
    <video src={own.url} controls playsInline preload="metadata" className={own.portrait ? "mx-auto block max-h-[75dvh] w-auto max-w-full rounded-2xl border border-border bg-black" : `${box} aspect-video`} />
  );
  return <div className={`${box} grid aspect-video place-items-center text-sm text-dim`}>Video coming soon</div>;
}
