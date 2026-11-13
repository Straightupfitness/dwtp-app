import { NextResponse } from "next/server";

/**
 * November 13: a tiny request so the proxy (the only place sign-ins are renewed) renews it if needed, before the
 * page uploads a photo or video straight to storage.
 */
export async function GET() {
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
