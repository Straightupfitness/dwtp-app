import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { thursdayScript } from "@/lib/ai/thursday";

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "coach") return NextResponse.json({ error: "Coach only" }, { status: 403 });
  const { clientId } = (await req.json()) as { clientId: string };
  try {
    return NextResponse.json(await thursdayScript(supabase, clientId));
  } catch (e) {
    console.error("thursday script failed", e);
    return NextResponse.json({ error: `The AI script failed: ${String((e as Error).message).slice(0, 200)}` }, { status: 502 });
  }
}
