import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateDraft } from "@/lib/ai/reply-draft";

export const maxDuration = 180;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "coach") return NextResponse.json({ error: "Coach only" }, { status: 403 });
  const { checkinId } = (await req.json()) as { checkinId: string };
  try {
    return NextResponse.json(await generateDraft(supabase, checkinId));
  } catch (e) {
    console.error("draft failed", e);
    return NextResponse.json({ error: `The AI draft failed: ${String((e as Error).message).slice(0, 200)}` }, { status: 502 });
  }
}
