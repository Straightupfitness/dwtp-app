import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lookupBarcode } from "@/lib/food-db";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const code = new URL(req.url).searchParams.get("code") ?? "";
  try {
    const food = await lookupBarcode(code);
    return food ? NextResponse.json({ food }) : NextResponse.json({ error: "That barcode isn't in the food databases yet. Snap a photo of the label or type it in." }, { status: 404 });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 502 }); }
}
