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

export async function proxy(request: NextRequest) {
  let response = withPath(request);
  const url = supabaseUrl();
  const key = supabaseKey();
  if (!url || !key) {
    // Keys missing in Vercel: show a clear message instead of crashing every page.
    return new NextResponse("DWTP setup: the Supabase URL or publishable key is missing in Vercel's environment variables.", { status: 503 });
  }
  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = withPath(request);
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  let user = null;
  try {
    ({ data: { user } } = await supabase.auth.getUser());
  } catch (err) {
    console.error("auth check failed", err);
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
