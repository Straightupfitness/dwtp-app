import { createHash, randomBytes } from "node:crypto";
import { adminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notify";

export const INVITE_DAYS = 14;
const hash = (t: string) => createHash("sha256").update(t).digest("hex");
export const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.straightupfitness.com").replace(/\/$/, "");

/**
 * A personal link that signs her in with one tap. Good for 14 days (or `days`), and it keeps working until then
 * (October 31: single-use links sent clients in circles when an email app opened them first or she tapped an
 * older email). Newer links don't cancel older ones. The link only shows a button; signing in takes her tap.
 */
export async function createInvite(userId: string, days = INVITE_DAYS) {
  const db = adminClient();
  const token = randomBytes(32).toString("base64url");
  const { error } = await db.from("invites").insert({
    user_id: userId, token_hash: hash(token), expires_at: new Date(Date.now() + days * 86_400_000).toISOString(),
  });
  if (error) throw new Error(`Couldn't create the welcome link: ${error.message}`);
  return `${appUrl()}/welcome?t=${token}`;
}

/** The invite behind a link, if it's still good. */
export async function findInvite(token: string) {
  if (!token) return null;
  const { data } = await adminClient().from("invites").select("id, user_id, expires_at, used_at").eq("token_hash", hash(token)).maybeSingle();
  if (!data) return null;
  return { ...data, valid: Date.parse(data.expires_at) > Date.now() };
}

export async function sendWelcome(userId: string, email: string, name: string | null) {
  const link = await createInvite(userId);
  const first = name?.split(" ")[0];
  const text = [
    first ? `Hi ${first},` : "Hi,",
    "Your DWTP app is ready. It's where your habits, food logging, weekly check-ins and messages with me live.",
    `Tap this link on your phone to open it. No password needed:\n${link}`,
    "Then, on iPhone: tap Share in Safari, then Add to Home Screen. On Android: tap the ⋮ menu, then Add to Home screen.",
    `The link is just for you and works for ${INVITE_DAYS} days. Keep this email: you can use it again on a new phone.`,
    "Talk to you soon,\nMichael",
  ].join("\n\n");
  const html = `<div style="background:#0a0a0a;padding:32px 16px;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:440px;margin:0 auto;background:#141414;border:1px solid #1e1e1e;border-radius:18px;padding:28px 24px;color:#f5f5f5">
    <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#f5a623">Driven Woman Transformation Program</p>
    <h1 style="margin:0 0 14px;font-size:26px;line-height:1.2">Welcome${first ? `, ${first}` : ""}. Your app is ready.</h1>
    <p style="margin:0 0 22px;font-size:16px;line-height:1.5;color:#c8c8c8">It's where your habits, food logging, weekly check-ins and messages with me live. Tap the button on your phone to open it. No password needed.</p>
    <a href="${link}" style="display:block;text-align:center;background:#f5a623;color:#0a0a0a;text-decoration:none;font-weight:600;font-size:17px;padding:16px 20px;border-radius:14px">Open my DWTP app</a>
    <p style="margin:24px 0 6px;font-size:14px;font-weight:600;color:#f5f5f5">Then put it on your Home Screen</p>
    <p style="margin:0;font-size:14px;line-height:1.5;color:#c8c8c8">iPhone: tap Share in Safari, then <b>Add to Home Screen</b>.<br>Android: tap the ⋮ menu, then <b>Add to Home screen</b>.</p>
    <p style="margin:22px 0 0;font-size:13px;line-height:1.5;color:#8a8a8a">This link is just for you and works for ${INVITE_DAYS} days.<br>Talk to you soon,<br>Michael</p>
  </div>
</div>`;
  return sendEmail(email, "Welcome to DWTP: your app is ready", text, undefined, html);
}
