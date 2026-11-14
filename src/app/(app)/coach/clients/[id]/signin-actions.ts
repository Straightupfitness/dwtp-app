"use server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { createSignInCode } from "@/lib/invite";

/**
 * November 13 (Connie couldn't get a sign-in email): Michael makes a sign-in code for her, good for 2 hours, and texts
 * it to her. She types her email and the code on the sign-in screen ("I already have a code").
 */
export async function signInCodeFor(clientId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "coach") return { error: "Coach only" };
  const db = adminClient();
  const { data: p } = await db.from("profiles").select("email").eq("id", clientId).single();
  const code = await createSignInCode(clientId);
  if (!code) return { error: "Couldn't make a code. Try again." };
  const since = new Date(Date.now() - 2 * 3_600_000).toISOString();
  const { count } = await db.from("notification_log").select("key", { count: "exact", head: true }).eq("user_id", clientId).like("key", "signin:%").gte("sent_at", since);
  return { code, email: (p?.email as string | null) ?? null, emailsLast2h: count ?? 0 };
}
