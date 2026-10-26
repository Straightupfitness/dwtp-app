/**
 * When a photo was taken, from its EXIF DateTimeOriginal (camera's local time), or null.
 * Lets a client snap her lunch at work and log it later at the right time.
 */
export async function photoTakenAt(file: Blob): Promise<Date | null> {
  try {
    const buf = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
    if (buf.getUint16(0) !== 0xffd8) return null; // not a JPEG
    let off = 2;
    while (off + 4 < buf.byteLength) {
      const marker = buf.getUint16(off), size = buf.getUint16(off + 2);
      if (marker === 0xffe1 && buf.getUint32(off + 4) === 0x45786966) return readTiff(buf, off + 10);
      if ((marker & 0xff00) !== 0xff00) return null;
      off += 2 + size;
    }
  } catch { /* unreadable: fall back to now */ }
  return null;
}

function readTiff(v: DataView, start: number): Date | null {
  const le = v.getUint16(start) === 0x4949;
  const u16 = (o: number) => v.getUint16(start + o, le), u32 = (o: number) => v.getUint32(start + o, le);
  const findTag = (ifd: number, tag: number) => {
    const n = u16(ifd);
    for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; if (u16(e) === tag) return e; }
    return -1;
  };
  const ifd0 = u32(4);
  const exifPtr = findTag(ifd0, 0x8769);
  const read = (ifd: number, tag: number) => {
    const e = findTag(ifd, tag);
    if (e < 0) return null;
    const at = start + u32(e + 8);
    let s = "";
    for (let i = 0; i < 19; i++) s += String.fromCharCode(v.getUint8(at + i));
    return s;
  };
  const s = (exifPtr >= 0 ? read(u32(exifPtr + 8), 0x9003) : null) ?? read(ifd0, 0x0132);
  const m = s?.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]); // camera local time = her local time
  return isNaN(d.getTime()) ? null : d;
}
