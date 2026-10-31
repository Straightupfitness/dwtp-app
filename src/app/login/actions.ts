"use server";
import { createInvite } from "@/lib/invite";
import { adminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notify";

export type SendResult = { ok: true } | { ok: false; reason: "notfound" | "toomany" | "failed" };

/**
 * Sends her a sign-in link by email (through Resend, from Michael's address).
 * The link is a personal link good for 3 days, so it works in any browser or email app,
 * not only the one she typed her email into, and an email app scanning it can't use it up.
 */
export async function sendSignInLink(raw: string): Promise<SendResult> {
  const email = raw.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, reason: "notfound" };
  const admin = adminClient();
  // Only people Michael has added can sign in: never create an account from this page.
  const { data: known } = await admin.from("profiles").select("id").ilike("email", email.replace(/[%_\\]/g, "\\$&")).maybeSingle();
  if (!known) return { ok: false, reason: "notfound" };
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data?.properties?.hashed_token || !data.user) {
    return { ok: false, reason: error && !/not.?found|no user|does not exist/i.test(error.message) ? "failed" : "notfound" };
  }

  // At most 5 links in 15 minutes.
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { count } = await admin.from("notification_log").select("key", { count: "exact", head: true })
    .eq("user_id", data.user.id).like("key", "signin:%").gte("sent_at", since);
  if ((count ?? 0) >= 5) return { ok: false, reason: "toomany" };
  await admin.from("notification_log").insert({ user_id: data.user.id, key: `signin:${Date.now()}` });

  // The button: a personal link that keeps working for 3 days (October 31: one-time links got used up by email
  // apps that open links to scan them, and an older email's link stopped working when she asked for a new one).
  const link = await createInvite(data.user.id, 3);

  const { data: p } = await admin.from("profiles").select("full_name").eq("id", data.user.id).maybeSingle();
  const first = p?.full_name?.split(" ")[0];
  const code = data.properties.email_otp;
  const text = `${first ? `Hi ${first},\n\n` : ""}Tap the link below to sign in to your DWTP app. It works for 3 days.\n\n${link}\n\nOr type this code in the app: ${code}\n\nDidn't ask for this? You can ignore this email.`;
  const html = `<div style="background:#0a0a0a;padding:32px 16px;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:420px;margin:0 auto;background:#141414;border:1px solid #1e1e1e;border-radius:18px;padding:28px 24px;color:#f5f5f5">
    <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#f5a623">Driven Woman Transformation Program</p>
    <h1 style="margin:0 0 14px;font-size:24px;line-height:1.2">${first ? `Hi ${first}, here's` : "Here's"} your sign-in link</h1>
    <p style="margin:0 0 22px;font-size:16px;line-height:1.5;color:#c8c8c8">Tap the button to open your app. It works for 3 days.</p>
    <a href="${link}" style="display:block;text-align:center;background:#f5a623;color:#0a0a0a;text-decoration:none;font-weight:600;font-size:17px;padding:15px 20px;border-radius:14px">Sign in to DWTP</a>
    <p style="margin:22px 0 4px;font-size:13px;color:#a8a8a8">Using the app from your Home Screen? Type this code instead (only the newest email&#39;s code works, for 1 hour):</p>
    <p style="margin:0;font-size:30px;letter-spacing:6px;font-weight:700;color:#ffcc75">${code}</p>
    <p style="margin:22px 0 0;font-size:13px;line-height:1.5;color:#8a8a8a">Didn't ask for this? You can ignore this email.<br>Michael</p>
  </div>
</div>`;
  const sent = await sendEmail(email, "Your DWTP sign-in link", text, undefined, html);
  return sent ? { ok: true } : { ok: false, reason: "failed" };
}
