import { createClient } from "@/lib/supabase/server";
import LiveRefresh from "@/components/LiveRefresh";
import ChatComposer from "./ChatComposer";
import Bubble from "./Bubble";

/** The 1:1 thread between a client and Michael. Used by her Chat tab and by Michael's inbox. */
export default async function ChatThread({ clientId, viewerId, otherName }: { clientId: string; viewerId: string; otherName: string }) {
  const supabase = await createClient();
  const { data: msgs } = await supabase.from("messages").select("id, sender_id, body, attachment_path, attachment_kind, audio_seconds, reply_to, edited_at, created_at, read_at, hearted_at")
    .eq("client_id", clientId).order("created_at", { ascending: false }).limit(200);
  const list = (msgs ?? []).reverse();
  const photos = new Map<string, string>();
  const paths = list.map((m) => m.attachment_path).filter(Boolean) as string[];
  if (paths.length) {
    const { data } = await supabase.storage.from("media").createSignedUrls(paths, 3600);
    data?.forEach((d) => d.path && d.signedUrl && photos.set(d.path, d.signedUrl));
  }
  // The message each reply points at (it may be older than the last 200).
  const byId = new Map(list.map((m) => [m.id, m]));
  const missing = [...new Set(list.map((m) => m.reply_to).filter((r): r is string => !!r && !byId.has(r)))];
  if (missing.length) {
    const { data: older } = await supabase.from("messages").select("id, sender_id, body, attachment_path, attachment_kind, audio_seconds, reply_to, edited_at, created_at, read_at, hearted_at").in("id", missing);
    for (const o of older ?? []) byId.set(o.id, o);
  }
  const quoteOf = (id: string | null) => {
    const q = id ? byId.get(id) : null;
    if (!q) return id ? { who: "", snippet: "Message no longer here" } : null;
    return { who: q.sender_id === viewerId ? "You" : otherName, snippet: q.body ? q.body.slice(0, 120) : q.attachment_kind === "audio" ? "🎤 Voice note" : "📷 Photo" };
  };
  const unread = list.filter((m) => m.sender_id !== viewerId && !m.read_at).length;
  // Times in the viewer's own time zone.
  const { data: viewer } = await supabase.from("profiles").select("timezone").eq("id", viewerId).maybeSingle();
  const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: viewer?.timezone ?? "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const lastMine = [...list].reverse().find((m) => m.sender_id === viewerId);

  return (
    <div className="pb-20">
      <LiveRefresh tables={["messages"]} filter={`client_id=eq.${clientId}`} />
      <ol className="space-y-2">
        {list.map((m, i) => {
          const mine = m.sender_id === viewerId;
          const showTime = i === 0 || Date.parse(m.created_at) - Date.parse(list[i - 1].created_at) > 30 * 60_000;
          return (
            <li key={m.id}>
              {showTime && <p className="py-2 text-center text-xs text-dim">{fmt(m.created_at)}</p>}
              <Bubble m={{
                id: m.id, mine, body: m.body, seconds: m.audio_seconds, edited: !!m.edited_at, hearted: !!m.hearted_at, senderName: mine ? "You" : otherName,
                photo: m.attachment_path && m.attachment_kind !== "audio" ? photos.get(m.attachment_path) ?? null : null,
                audio: m.attachment_path && m.attachment_kind === "audio" ? photos.get(m.attachment_path) ?? null : null,
                quote: quoteOf(m.reply_to),
              }} />
            </li>
          );
        })}
      </ol>
      {lastMine && <p className="pt-1 text-right text-xs text-dim">{lastMine.read_at ? `Seen by ${otherName}` : "Sent"}</p>}
      {!list.length && <p className="py-8 text-center text-dim">No messages yet. Say hi to {otherName}.</p>}
      <ChatComposer clientId={clientId} unread={unread} />
    </div>
  );
}
