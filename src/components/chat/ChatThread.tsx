import { createClient } from "@/lib/supabase/server";
import LiveRefresh from "@/components/LiveRefresh";
import ChatComposer from "./ChatComposer";
import { HeartButton } from "./Heart";

/** The 1:1 thread between a client and Michael. Used by her Chat tab and by Michael's inbox. */
export default async function ChatThread({ clientId, viewerId, otherName }: { clientId: string; viewerId: string; otherName: string }) {
  const supabase = await createClient();
  const { data: msgs } = await supabase.from("messages").select("id, sender_id, body, attachment_path, created_at, read_at, hearted_at")
    .eq("client_id", clientId).order("created_at", { ascending: false }).limit(200);
  const list = (msgs ?? []).reverse();
  const photos = new Map<string, string>();
  const paths = list.map((m) => m.attachment_path).filter(Boolean) as string[];
  if (paths.length) {
    const { data } = await supabase.storage.from("media").createSignedUrls(paths, 3600);
    data?.forEach((d) => d.path && d.signedUrl && photos.set(d.path, d.signedUrl));
  }
  const unread = list.filter((m) => m.sender_id !== viewerId && !m.read_at).length;
  const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
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
              <div className={`flex items-end gap-1 ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`relative max-w-[80%] space-y-1 rounded-[18px] px-3.5 py-2.5 text-[15px] leading-snug ${mine ? "rounded-br-md bg-accent text-black" : "rounded-bl-md bg-[#1b1b1b]"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL */}
                  {m.attachment_path && photos.get(m.attachment_path) && <img src={photos.get(m.attachment_path)} alt="" className="rounded-[14px]" />}
                  {m.body && <p className="whitespace-pre-line">{m.body}</p>}
                  {/* Her ♥ on my message shows on it */}
                  {mine && m.hearted_at && <span className="absolute -bottom-2 -left-2 grid size-6 place-items-center rounded-full border-2 border-bg bg-[#2a1218] text-[12px] text-[#fb7185]" aria-label="Liked">♥</span>}
                </div>
                {!mine && <HeartButton id={m.id} hearted={!!m.hearted_at} />}
              </div>
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
