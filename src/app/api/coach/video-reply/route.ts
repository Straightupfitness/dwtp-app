import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendVideoReply } from "@/app/(app)/coach/followups/actions";

/**
 * November 20 (Michael): "Record myself" sends its video to her chat from any page, including while he's looking at
 * her app ("See her app" is look-only for server actions, so this goes through /api, where he's always himself).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "coach") return NextResponse.json({ error: "Coach only" }, { status: 403 });
  const { clientId, path, note } = (await req.json()) as { clientId: string; path: string; note: string };
  if (!/^[0-9a-f-]{36}$/.test(clientId ?? "")) return NextResponse.json({ error: "Which client?" }, { status: 400 });
  const r = await sendVideoReply(clientId, path, note ?? "");
  return NextResponse.json(r ?? { ok: true }, { status: r?.error ? 400 : 200 });
}
