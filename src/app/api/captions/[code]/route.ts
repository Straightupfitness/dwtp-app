import { createClient } from "@/lib/supabase/server";

/** November 21: a program video's captions (WebVTT). 404 when it has none yet. */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("program_videos").select("captions").eq("code", code.toUpperCase()).maybeSingle();
  const vtt = (data as { captions?: string | null } | null)?.captions;
  if (!vtt) return new Response("", { status: 404 });
  return new Response(vtt, { headers: { "content-type": "text/vtt; charset=utf-8", "cache-control": "private, max-age=3600" } });
}
