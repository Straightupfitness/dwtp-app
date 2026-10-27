import { syncHealth } from "@/lib/health";

export const maxDuration = 30;

/**
 * Her iPhone Shortcut posts here (JSON or form fields): code, steps, sleep_hours (or sleep_minutes), weight, weight_unit, date.
 * The code can also come as "Authorization: Bearer CODE". The answer is one plain sentence the Shortcut shows her.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  const type = req.headers.get("content-type") ?? "";
  try {
    if (type.includes("json")) body = await req.json();
    else { const f = await req.formData(); f.forEach((v, k) => { body[k] = String(v); }); }
  } catch { /* empty or unreadable body */ }
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const r = await syncHealth({ ...body, code: String(body.code ?? bearer ?? "") } as never).catch((e) => {
    console.error("health sync failed", e);
    return { error: "Something went wrong on DWTP's side. Try again later." };
  });
  return new Response("error" in r && r.error ? r.error : (r as { message: string }).message, {
    status: "error" in r && r.error ? 400 : 200, headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
