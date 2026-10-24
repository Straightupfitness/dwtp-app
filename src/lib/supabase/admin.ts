import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./config";

/** Server-only client with the service role key: bypasses row-level security. Use for background jobs. */
export function adminClient() {
  // Strip any spaces or line breaks a copy-paste may have added inside the key.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\s+/g, "");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set in Vercel.");
  return createClient(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Never show a key in an error message on screen. */
export function safeError(e: unknown): string {
  const msg = String((e as Error)?.message ?? e);
  return msg.replace(/(sb_secret_|sb_publishable_|sk-ant-|re_)[A-Za-z0-9_\- ]+/g, "[hidden key]")
    .replace(/Bearer\s+\S+(\s+\S+)?/g, "Bearer [hidden key]");
}
