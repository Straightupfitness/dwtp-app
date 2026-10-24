import "server-only";
import webpush from "web-push";
import { after } from "next/server";
import { adminClient } from "./supabase/admin";

/**
 * Tell someone something: a push notification on every device she turned them on for, plus an email
 * (when `email` is given and she hasn't turned email off). `dedupeKey` makes sure it only ever goes once.
 * Never throws: a failed notification must not break the action that triggered it.
 */
export type Note = {
  title: string; body: string; url: string;
  email?: { subject: string; text: string } | "push-fallback";  // "push-fallback": email only if she has no push devices
  dedupeKey?: string;
};

const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.straightupfitness.com").replace(/\/$/, "");

export async function vapidKeys() {
  const db = adminClient();
  const { data, error } = await db.from("app_config").select("key, value").in("key", ["vapid_public", "vapid_private"]);
  if (error || !data) throw new Error("The app couldn't reach its settings. Check SUPABASE_SERVICE_ROLE_KEY in Vercel.");
  const pub = data?.find((r) => r.key === "vapid_public")?.value, priv = data?.find((r) => r.key === "vapid_private")?.value;
  if (pub && priv) return { publicKey: pub, privateKey: priv };
  const k = webpush.generateVAPIDKeys();
  await db.from("app_config").upsert([{ key: "vapid_public", value: k.publicKey }, { key: "vapid_private", value: k.privateKey }], { onConflict: "key", ignoreDuplicates: true });
  const { data: again } = await db.from("app_config").select("key, value").in("key", ["vapid_public", "vapid_private"]);
  if (!again?.length) throw new Error("The app couldn't save its push settings. Check SUPABASE_SERVICE_ROLE_KEY in Vercel.");
  return { publicKey: again.find((r) => r.key === "vapid_public")!.value, privateKey: again.find((r) => r.key === "vapid_private")!.value };
}

export async function notify(userIds: string | string[], note: Note) {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  await Promise.all(ids.map((id) => notifyOne(id, note).catch((e) => console.error("notify failed", id, e))));
}

/** Same as notify, but runs after the response is sent, so sending a message stays instant. */
export function notifyLater(userIds: string | string[] | Promise<string[]>, note: Note) {
  after(async () => notify(await userIds, note));
}

async function notifyOne(userId: string, note: Note) {
  const db = adminClient();
  if (note.dedupeKey) {
    const { error } = await db.from("notification_log").insert({ user_id: userId, key: note.dedupeKey });
    if (error) return; // already sent
  }
  const [{ data: subs }, { data: p }] = await Promise.all([
    db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId),
    db.from("profiles").select("email, full_name, email_notifications").eq("id", userId).single(),
  ]);

  let pushed = 0;
  if (subs?.length) {
    const keys = await vapidKeys();
    webpush.setVapidDetails("mailto:michael@straightupfitness.com", keys.publicKey, keys.privateKey);
    const payload = JSON.stringify({ title: note.title, body: note.body, url: note.url });
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 });
        pushed++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", s.id); // phone unsubscribed
        else console.error("push failed", code);
      }
    }));
  }

  const wantEmail = note.email && p?.email && p.email_notifications && !(note.email === "push-fallback" && pushed > 0);
  if (wantEmail) {
    const e = note.email === "push-fallback" ? { subject: note.title, text: note.body } : note.email!;
    await sendEmail(p!.email!, e.subject, `${e.text}\n\nOpen the app: ${APP_URL()}${note.url}`, p?.full_name ?? undefined);
  }
}

export async function sendEmail(to: string, subject: string, text: string, name?: string) {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) { console.warn("RESEND_API_KEY not set; email skipped:", subject); return; }
  const from = process.env.EMAIL_FROM?.trim() || "Michael at DWTP <coach@straightupfitness.com>";
  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#111">${
    (name ? `<p>Hi ${name.split(" ")[0]},</p>` : "") + text.split("\n\n").map((para) =>
      `<p>${para.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>").replace(/(https:\/\/\S+)/g, '<a href="$1">$1</a>')}</p>`).join("")
  }</div>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to, subject, text, html }),
  });
  if (!res.ok) console.error("email failed", res.status, (await res.text()).slice(0, 200));
}

export async function coachIds(): Promise<string[]> {
  const { data } = await adminClient().from("profiles").select("id").eq("role", "coach");
  return (data ?? []).map((r) => r.id);
}
