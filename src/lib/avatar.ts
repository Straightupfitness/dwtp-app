import { supabaseUrl } from "./supabase/config";
/** Public link to a profile picture (avatars bucket), or null. */
export function avatarUrl(path: string | null | undefined): string | null {
  return path ? `${supabaseUrl()}/storage/v1/object/public/avatars/${path}` : null;
}
