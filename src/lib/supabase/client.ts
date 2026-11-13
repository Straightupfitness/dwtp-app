import { supabaseKey, supabaseUrl } from "./config";
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // November 13 (Connie kept getting signed out): the server (proxy) is the only one that renews her sign-in.
  // On iPhone the Home Screen app is often frozen mid-renewal; when the page renewed in the background and the
  // answer was lost, the next try failed and the library deleted her session. Now the page never renews on its own.
  return createBrowserClient(supabaseUrl(), supabaseKey(), { auth: { autoRefreshToken: false } });
}
