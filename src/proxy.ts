import { supabaseKey, supabaseUrl } from "@/lib/supabase/config";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth", "/welcome", "/api/webhooks", "/api/cron", "/api/health/sync", "/sw.js", "/manifest.webmanifest", "/brand", "/sounds"];

// The path, for the server: Michael's "see her app" view applies to her pages, never to /coach (November 2).
const withPath = (request: NextRequest) => {
  const headers = new Headers(request.headers);
  headers.set("x-dwtp-path", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
};

const TOUCH = "dwtp_auth_touch";

/** Which client a session cookie belonged to (for the "session lost" log only; not trusted for anything else). */
function whoFromCookie(request: NextRequest): string | null {
  try {
    const parts = request.cookies.getAll().filter((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token")).sort((a, b) => a.name.localeCompare(b.name)).map((c) => c.value).join("");
    const raw = parts.startsWith("base64-") ? atob(parts.slice(7).replace(/-/g, "+").replace(/_/g, "/")) : decodeURIComponent(parts);
    const token = (JSON.parse(raw) as { access_token?: string }).access_token ?? "";
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: string; email?: string; exp?: number };
    return `${payload.email ?? payload.sub} (token expired ${payload.exp ? new Date(payload.exp * 1000).toISOString() : "?"})`;
  } catch {
    return null;
  }
}

/** November 13: write to the auth_events log (best effort; never slows or breaks a page). */
async function logAuth(row: Record<string, unknown>) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\s+/g, "");
  if (!key) return;
  try {
    await fetch(`${supabaseUrl()}/rest/v1/auth_events`, {
      method: "POST", signal: AbortSignal.timeout(1500),
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(row),
    });
  } catch {}
}

export async function proxy(request: NextRequest) {
  let response = withPath(request);
  const url = supabaseUrl();
  const key = supabaseKey();
  if (!url || !key) {
    // Keys missing in Vercel: show a clear message instead of crashing every page.
    return new NextResponse("DWTP setup: the Supabase URL or publishable key is missing in Vercel's environment variables.", { status: 503 });
  }
  let refreshed = false;
  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          refreshed = true;
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = withPath(request);
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  let user = null;
  const hadSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
  try {
    const { data, error } = await supabase.auth.getUser();
    user = data.user;
    // November 13 (Connie keeps getting signed out): say why in the logs when someone who had a session loses it.
    if (!user && hadSession) {
      const ev = { kind: "lost", path: request.nextUrl.pathname, who: whoFromCookie(request), code: (error as { code?: string } | null)?.code ?? null, message: error?.message ?? null, agent: request.headers.get("user-agent")?.slice(0, 200) ?? null };
      console.error("session lost", JSON.stringify(ev));
      await logAuth(ev);
    } else if (user && refreshed) {
      await logAuth({ kind: "refreshed", user_id: user.id, who: user.email ?? null, path: request.nextUrl.pathname, agent: request.headers.get("user-agent")?.slice(0, 200) ?? null });
    }
  } catch (err) {
    console.error("auth check failed", err);
  }
  // November 13: iPhones cap sign-in cookies that a page writes itself (the background token refresh) at 7 days.
  // Once a day, the server writes them again for 400 days, so a Home Screen app stays signed in.
  if (user && !request.cookies.get(TOUCH)) {
    for (const c of request.cookies.getAll()) {
      if (c.name.startsWith("sb-") && c.name.includes("-auth-token")) response.cookies.set(c.name, c.value, { path: "/", sameSite: "lax", secure: true, httpOnly: false, maxAge: 400 * 86_400 });
    }
    response.cookies.set(TOUCH, "1", { path: "/", sameSite: "lax", secure: true, httpOnly: true, maxAge: 86_400 });
  }
  const path = request.nextUrl.pathname;
  const isPublic = path === "/" || PUBLIC_PATHS.some((p) => path.startsWith(p));
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand|manifest.webmanifest|favicon.ico).*)"],
};
