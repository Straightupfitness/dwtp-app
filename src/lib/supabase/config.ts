/** Supabase settings from Vercel. The URL is reduced to its origin, so a pasted
 *  ".../rest/v1/" or trailing slash can't break requests. */
export function supabaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  try {
    return new URL(raw).origin;
  } catch {
    return raw;
  }
}

export function supabaseKey(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
}
