import { NextResponse } from "next/server";
import { VIEW_AS_COOKIE } from "@/lib/supabase/server";

/** Leave "See her app": close the window (or go back to her page). */
export async function GET(req: Request) {
  const back = new URL(req.url).searchParams.get("to");
  const to = back && /^\/coach\/clients\/[0-9a-f-]{36}$/.test(back) ? back : "/coach";
  const html = `<!doctype html><meta name=viewport content="width=device-width"><body style="background:#0a0a0a;color:#eee;font-family:system-ui;padding:24px">
<p>Done. You can close this window.</p><script>window.close();setTimeout(function(){location.replace(${JSON.stringify(to)})},300)</script>`;
  const res = new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  res.cookies.set(VIEW_AS_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
