// Builds the iPhone launch screens (November 7) the app shows while it opens from the Home Screen.
// Run: node scripts/make-splash.mjs   (uses public/brand/splash-photo.jpg as the background when it's there)
// Then shrink them: python3 -c "import glob;from PIL import Image;[Image.open(f).convert('RGB').quantize(colors=128).save(f,optimize=True) for f in glob.glob('public/splash/*.png')]"
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
// [css width, css height, pixel ratio]: every iPhone from the 8/SE to the 17 series.
export const SIZES = [
  [440, 956, 3], [402, 874, 3], [420, 912, 3], [430, 932, 3], [393, 852, 3], [428, 926, 3], [390, 844, 3],
  [375, 812, 3], [414, 896, 3], [414, 896, 2], [414, 736, 3], [375, 667, 2], [320, 568, 2],
];
const b64 = (f) => readFileSync(path.join(root, f)).toString("base64");
const logo = `data:image/png;base64,${b64("public/brand/dwtp-logo.png")}`;
const font = `data:font/woff2;base64,${b64("node_modules/@fontsource/oswald/files/oswald-latin-500-normal.woff2")}`;
const photoFile = "public/brand/splash-photo.jpg";
const photo = existsSync(path.join(root, photoFile)) ? `data:image/jpeg;base64,${b64(photoFile)}` : null;

const html = (w, h) => `<!doctype html><html><head><style>
  @font-face{font-family:Oswald;font-weight:500;src:url(${font}) format('woff2')}
  *{margin:0;box-sizing:border-box} html,body{width:${w}px;height:${h}px;background:#000;overflow:hidden;font-family:Oswald,Impact,sans-serif}
  .bg{position:absolute;inset:0;background:${photo ? `url(${photo}) center 30%/cover` : "#000"}}
  .fade{position:absolute;inset:0;background:${photo ? "linear-gradient(180deg,rgba(10,10,10,.15) 0%,rgba(10,10,10,.1) 45%,rgba(10,10,10,.85) 72%,#0a0a0a 100%)" : "none"}}
  .wrap{position:absolute;left:0;right:0;${photo ? `bottom:${Math.round(h * 0.09)}px` : `top:50%;transform:translateY(-58%)`};display:flex;flex-direction:column;align-items:center;gap:${Math.round(w * 0.05)}px}
  img{mix-blend-mode:lighten;width:${Math.round(w * (photo ? 0.5 : 0.62))}px}
  .line{color:#f5a623;letter-spacing:.32em;text-transform:uppercase;font-weight:500;font-size:${Math.round(w * 0.04)}px;padding-left:.32em}
  .bar{width:${Math.round(w * 0.1)}px;height:3px;border-radius:2px;background:#f5a623;opacity:.8}
</style></head><body><div class="bg"></div><div class="fade"></div>
<div class="wrap"><img src="${logo}" alt=""><div class="bar"></div><div class="line">Strong · Rested · Driven</div></div></body></html>`;

const browser = await chromium.launch();
const tags = [];
for (const [w, h, r] of SIZES) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: r });
  await page.setContent(html(w, h), { waitUntil: "networkidle" }).catch(() => page.setContent(html(w, h)));
  const name = `splash-${w * r}x${h * r}.png`;
  await page.screenshot({ path: path.join(root, "public/splash", name) });
  await page.close();
  tags.push({ w, h, r, href: `/splash/${name}` });
}
await browser.close();
writeFileSync(path.join(root, "src/lib/splash.json"), JSON.stringify(tags, null, 1) + "\n");
console.log(`${tags.length} launch screens${photo ? " (with photo)" : ""}`);
