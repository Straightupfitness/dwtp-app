/**
 * November 21 (Michael): captions on his program videos. Each video's captions are served by the app at
 * /api/captions/<code>, worked out from the video's own address (…/program-videos/MED-51.mp4?v=…).
 * No captions yet → the app answers 404 and the video just plays without them.
 */
export function captionSrc(url: string | null | undefined): string | null {
  const m = url?.match(/\/program-videos\/([A-Z0-9]+-\d+)\.[a-z0-9]+(?:\?v=([^#&]+))?/i);
  return m ? `/api/captions/${m[1].toUpperCase()}${m[2] ? `?v=${m[2]}` : ""}` : null;
}

/** For players that switch their video in code: put the matching captions track on it, showing. */
export function syncCaptions(v: HTMLVideoElement | null, url: string | null | undefined) {
  if (!v) return;
  const src = captionSrc(url);
  v.querySelectorAll("track").forEach((t) => t.remove());
  if (!src) return;
  const t = document.createElement("track");
  t.kind = "captions"; t.srclang = "en"; t.label = "English"; t.default = true; t.src = src;
  t.addEventListener("load", () => { t.track.mode = "showing"; });
  v.appendChild(t);
  t.track.mode = "showing";
}
