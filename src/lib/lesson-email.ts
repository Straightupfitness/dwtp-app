/** The Strong Body Wednesday and Strong Mind Friday emails: the full lesson, in Michael's words, with a button into the app. */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function lessonEmail(o: {
  kind: "sbw" | "smf"; week: number; title: string; body: string | null; firstName?: string | null;
  button: { label: string; url: string }; secondary?: { label: string; url: string };
}) {
  const name = o.kind === "sbw" ? "Strong Body Wednesday" : "Strong Mind Friday";
  const subject = `${name} · Week ${o.week}: ${o.title}`;
  const paras = (o.body ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const text = [
    o.firstName ? `Hi ${o.firstName},` : null, `${name.toUpperCase()} · WEEK ${o.week}`, o.title, ...paras,
    `${o.button.label}: ${o.button.url}`, o.secondary ? `${o.secondary.label}: ${o.secondary.url}` : null, "Michael",
  ].filter(Boolean).join("\n\n");

  const p = (t: string) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#d8d8d8">${esc(t).replace(/\n/g, "<br>").replace(/(https:\/\/\S+)/g, '<a href="$1" style="color:#f5a623">$1</a>')}</p>`;
  const html = `<div style="background:#0a0a0a;padding:28px 12px;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#141414;border:1px solid #1e1e1e;border-radius:18px;padding:28px 22px;color:#f5f5f5">
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#f5a623">${name} · Week ${o.week}</p>
    <h1 style="margin:0 0 18px;font-size:25px;line-height:1.25;color:#ffffff">${esc(o.title)}</h1>
    ${o.firstName ? p(`Hi ${o.firstName},`) : ""}
    ${paras.map(p).join("\n    ")}
    <a href="${o.button.url}" style="display:block;margin-top:22px;text-align:center;background:#f5a623;color:#0a0a0a;text-decoration:none;font-weight:600;font-size:17px;padding:15px 20px;border-radius:14px">${esc(o.button.label)}</a>
    ${o.secondary ? `<p style="margin:14px 0 0;text-align:center;font-size:14px"><a href="${o.secondary.url}" style="color:#f5a623">${esc(o.secondary.label)}</a></p>` : ""}
    <p style="margin:24px 0 0;font-size:14px;color:#a8a8a8">Michael</p>
  </div>
  <p style="max-width:560px;margin:14px auto 0;text-align:center;font-size:12px;color:#6b6b6b">The Driven Woman Transformation Program · Turn these emails off in the app under Me.</p>
</div>`;
  return { subject, text, html };
}
