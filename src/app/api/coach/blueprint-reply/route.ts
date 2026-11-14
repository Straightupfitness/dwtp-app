import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { blueprintReplyPoints } from "@/lib/ai/blueprint-reply";

export const maxDuration = 120;

/** November 13: AI talking points for Michael's video reply to her Blueprint (coach only). Saved so they come back. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "coach") return NextResponse.json({ error: "Coach only" }, { status: 403 });
  const { clientId } = (await req.json()) as { clientId: string };
  try {
    const r = await blueprintReplyPoints(supabase, clientId);
    await supabase.from("coach_followups").upsert({ client_id: clientId, topic: "blueprint-reply", brief: r, brief_at: r.at }, { onConflict: "client_id,topic" });
    return NextResponse.json(r);
  } catch (e) {
    console.error("blueprint reply points failed", e);
    return NextResponse.json({ error: String((e as Error).message).slice(0, 200) }, { status: 502 });
  }
}
