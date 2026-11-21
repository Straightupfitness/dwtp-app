/**
 * Shrink a photo to at most `max` px (JPEG) before upload. Browser only.
 * November 21: some Android phones can't decode a camera photo with createImageBitmap (it throws, and Snap it used to
 * do nothing). So: try createImageBitmap, then a plain <img>, and if both fail send the original photo as it is.
 */
export async function shrinkImage(file: File | Blob, max = 1280, quality = 0.82): Promise<Blob> {
  const draw = (src: CanvasImageSource, w: number, h: number) => new Promise<Blob | null>((res) => {
    try {
      const scale = Math.min(1, max / Math.max(w, h));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w * scale));
      c.height = Math.max(1, Math.round(h * scale));
      const g = c.getContext("2d");
      if (!g) return res(null);
      g.drawImage(src, 0, 0, c.width, c.height);
      c.toBlob((b) => res(b && b.size ? b : null), "image/jpeg", quality);
    } catch { res(null); }
  });
  try {
    const bmp = await createImageBitmap(file);
    const out = await draw(bmp, bmp.width, bmp.height);
    bmp.close?.();
    if (out) return out;
  } catch { /* fall through to <img> */ }
  try {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error("decode")); img.src = url; });
      const out = await draw(img, img.naturalWidth, img.naturalHeight);
      if (out) return out;
    } finally { URL.revokeObjectURL(url); }
  } catch { /* fall through to the original */ }
  return file;
}
