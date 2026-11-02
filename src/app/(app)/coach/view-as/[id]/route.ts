import { NextResponse } from "next/server";
import { createClient, VIEW_AS_COOKIE } from "@/lib/supabase/server";

/** "See her app" (November 2): Michael looks at the app exactly as this client sees it, look-only. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  const { data: her } = await supabase.from("profiles").select("id, role").eq("id", id).maybeSingle();
  if (me?.role !== "coach" || !her || her.role === "coach") return NextResponse.redirect(new URL("/coach", req.url));
  const res = NextResponse.redirect(new URL("/today", req.url));
  res.cookies.set(VIEW_AS_COOKIE, id, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 4 * 3600 });
  return res;
}
