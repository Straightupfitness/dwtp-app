import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { vapidKeys } from "@/lib/notify";

/** GET: the public key a phone needs to subscribe. POST: save this phone. DELETE: forget it. */
export async function GET() {
  try { return NextResponse.json({ publicKey: (await vapidKeys()).publicKey }); }
  catch (e) { return NextResponse.json({ error: String((e as Error).message) }, { status: 500 }); }
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const sub = (await req.json()) as { endpoint: string; keys: { p256dh: string; auth: string } };
  if (!sub?.endpoint || !sub.keys?.p256dh) return NextResponse.json({ error: "Bad subscription" }, { status: 400 });
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({ user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { endpoint } = (await req.json()) as { endpoint: string };
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}
