import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "./daily";
import { todayIn } from "./program";

/** The day Michael's "days in the app" record starts (November 1). Earlier days show as unknown. */
export const SEEN_SINCE = "2026-11-01";

/** One row per day she opens the app (her date), kept in notification_log as "seen:YYYY-MM-DD". */
export async function recordSeen(admin: SupabaseClient, userId: string, timezone: string | null) {
  const day = todayIn(timezone ?? "America/Los_Angeles");
  await admin.from("notification_log").upsert({ user_id: userId, key: `seen:${day}` }, { onConflict: "user_id,key", ignoreDuplicates: true });
}

export type SeenWeek = { days: { date: string; seen: boolean | null }[]; lastDate: string | null };

/**
 * For each client: the last `count` days ending today (her time zone), oldest first: true = opened the app,
 * false = didn't, null = before the record started. Plus the date she was last in.
 */
export async function loadSeen(admin: SupabaseClient, clients: { id: string; timezone: string | null; lastSeen: string | null }[], count = 7) {
  const out = new Map<string, SeenWeek>();
  if (!clients.length) return out;
  const since = addDays(todayIn("Pacific/Kiritimati"), -(count + 1));
  const rows: { user_id: string; key: string }[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data } = await admin.from("notification_log").select("user_id, key").in("user_id", clients.map((c) => c.id))
      .like("key", "seen:%").gte("key", `seen:${since}`).range(from, from + 999);
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  const by = new Map<string, Set<string>>();
  for (const r of rows) { const s = by.get(r.user_id) ?? new Set<string>(); s.add(r.key.slice(5)); by.set(r.user_id, s); }
  for (const c of clients) {
    const tz = c.timezone ?? "America/Los_Angeles";
    const today = todayIn(tz);
    const set = by.get(c.id) ?? new Set<string>();
    const lastDate = c.lastSeen ? todayIn(tz, new Date(c.lastSeen)) : null;
    if (lastDate) set.add(lastDate);
    out.set(c.id, {
      lastDate,
      days: Array.from({ length: count }, (_, i) => {
        const date = addDays(today, i - (count - 1));
        return { date, seen: set.has(date) ? true : date < SEEN_SINCE ? null : false };
      }),
    });
  }
  return out;
}
