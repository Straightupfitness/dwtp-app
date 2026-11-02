import { supabaseKey, supabaseUrl } from "./config";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";

/** Michael's "See her app" (November 2): which client he's looking at, in a cookie. */
export const VIEW_AS_COOKIE = "dwtp_view_as";

export async function createClient() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    supabaseUrl(),
    supabaseKey(),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            /* called from a Server Component; middleware refreshes the session */
          }
        },
      },
    },
  );
  const as = await viewingAs(supabase);
  if (as) {
    // Her pages render as her: every "who am I" answers with her. Anything that would change her data
    // (a server action) gets no user, so it does nothing: this view is look-only.
    const h = await headers();
    const action = !!h.get("next-action");
    supabase.auth.getUser = (async () => (action
      ? { data: { user: null }, error: null }
      : { data: { user: as.user }, error: null })) as typeof supabase.auth.getUser;
  }
  return supabase;
}

/**
 * When Michael (a coach) has "See her app" on and this is one of her pages (not /coach or /api):
 * the client he's looking at. Otherwise null.
 */
async function viewingAs(supabase: SupabaseClient): Promise<{ user: User; name: string | null } | null> {
  const cookieStore = await cookies();
  const id = cookieStore.get(VIEW_AS_COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const path = (await headers()).get("x-dwtp-path") ?? "";
  if (!path || path.startsWith("/coach") || path.startsWith("/api") || path.startsWith("/login") || path.startsWith("/welcome")) return null;
  const { data: { user: real } } = await supabase.auth.getUser();
  if (!real) return null;
  const { data: rows } = await supabase.from("profiles").select("id, role, email, full_name").in("id", [real.id, id]);
  const me = rows?.find((r) => r.id === real.id), her = rows?.find((r) => r.id === id);
  if (me?.role !== "coach" || !her || her.role === "coach") return null;
  return { user: { ...real, id: her.id, email: her.email ?? undefined, user_metadata: {} }, name: her.full_name };
}

/** For the layout: the client Michael is viewing as on this page, if any. */
export async function viewAsInfo() {
  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl(), supabaseKey(), { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } });
  const as = await viewingAs(supabase);
  return as ? { id: as.user.id, name: as.name } : null;
}
