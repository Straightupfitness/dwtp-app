import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { draftQuiz } from "@/lib/ai/quiz";

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "coach") return NextResponse.json({ error: "Coach only" }, { status: 403 });
  const { lessonId } = (await req.json()) as { lessonId: string };
  try {
    return NextResponse.json({ quiz: await draftQuiz(supabase, lessonId) });
  } catch (e) {
    console.error("quiz draft failed", e);
    return NextResponse.json({ error: `The AI quiz failed: ${String((e as Error).message).slice(0, 200)}` }, { status: 502 });
  }
}
