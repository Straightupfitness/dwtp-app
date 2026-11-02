import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notify } from "./notify";
import { todayIn } from "./program";

/**
 * Michael's automatic birthday message (November 2): on her birthday morning, a chat message from him,
 * "Happy Birthday {first}!" by default. He can turn it off or change the words (Inbox → Birthday messages).
 */
export const BIRTHDAY_DEFAULT = "Happy Birthday {first}! 🎉";

export async function birthdaySettings(admin: SupabaseClient) {
  const { data } = await admin.from("app_config").select("key, value").in("key", ["birthday_on", "birthday_message"]);
  const get = (k: string) => data?.find((r) => r.key === k)?.value;
  return { on: get("birthday_on") !== "off", message: get("birthday_message") || BIRTHDAY_DEFAULT };
}

/** Is today her birthday, in her time zone? (Feb 29 birthdays get Feb 28 in other years.) */
export function isBirthday(birthday: string, today: string) {
  const md = birthday.slice(5), t = today.slice(5);
  if (md === t) return true;
  const y = Number(today.slice(0, 4)), leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return md === "02-29" && !leap && t === "02-28";
}

const firstName = (p: { full_name: string | null; email: string | null }) => (p.full_name || p.email || "").trim().split(/\s+/)[0] || "there";
export const fillFirst = (t: string, first: string) => t.replace(/\{\s*first\s*(name)?\s*\}|\[\s*first\s*name\s*\]|\bfirst_?name\b/gi, first);

/** Send today's birthday messages (once each per year). Returns how many went out. */
export async function sendBirthdays(admin: SupabaseClient) {
  const s = await birthdaySettings(admin);
  if (!s.on) return 0;
  const { data: clients, error } = await admin.from("profiles").select("id, full_name, email, timezone, birthday, status")
    .eq("role", "client").not("birthday", "is", null).neq("status", "cancelled");
  if (error) return 0; // the birthday column isn't there yet (0032)
  const { data: coach } = await admin.from("profiles").select("id").eq("role", "coach").limit(1).maybeSingle();
  if (!coach) return 0;
  let sent = 0;
  for (const c of clients ?? []) {
    const today = todayIn(c.timezone ?? "America/Los_Angeles");
    if (!c.birthday || !isBirthday(c.birthday, today)) continue;
    // Claim this year's message first, so it never goes twice.
    const { error: dup } = await admin.from("notification_log").insert({ user_id: c.id, key: `birthday:${today.slice(0, 4)}` });
    if (dup) continue;
    const body = fillFirst(s.message, firstName(c)).trim();
    const { error: e } = await admin.from("messages").insert({ client_id: c.id, sender_id: coach.id, body });
    if (e) continue;
    await notify(c.id, { title: "Michael", body: body.slice(0, 120), url: "/chat", email: "push-fallback" });
    sent++;
  }
  return sent;
}
