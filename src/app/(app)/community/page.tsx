import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { shortName, timeAgo } from "@/lib/names";
import LiveRefresh from "@/components/LiveRefresh";
import Composer from "./Composer";
import { CommentBox, DeleteButton, LikeButton, PinButton } from "./PostActions";

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ tab?: string; board?: string }> }) {
  const { tab, board } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  const coach = me?.role === "coach";
  const Tabs = (
    <div className="flex gap-2">
      {[["feed", "Feed"], ["leaderboard", "Leaderboard"]].map(([v, l]) => (
        <Link key={v} href={v === "feed" ? "/community" : "/community?tab=leaderboard"}
          className={`min-h-11 flex-1 rounded-full border text-center text-sm leading-[2.6rem] ${(tab ?? "feed") === v ? "border-accent bg-accent font-semibold text-black" : "border-border"}`}>{l}</Link>
      ))}
    </div>
  );
  const header = (
    <header>
      <p className="text-xs uppercase tracking-[0.15em] text-accent">Driven women</p>
      <h1 className="font-[family-name:var(--font-display)] text-3xl uppercase">Community</h1>
    </header>
  );

  if (tab === "leaderboard") {
    const all = board === "all";
    const { data: rows } = await supabase.from(all ? "leaderboard_all_time" : "leaderboard_this_week")
      .select("client_id, full_name, cps").order("cps", { ascending: false }).limit(50);
    const list = (rows ?? []).filter((r) => r.cps > 0 || r.client_id === user!.id);
    return (
      <section className="space-y-4">
        {header}{Tabs}
        <div className="flex justify-center gap-4 text-sm">
          <Link href="/community?tab=leaderboard" className={!all ? "text-accent underline underline-offset-4" : "text-dim"}>This week</Link>
          <Link href="/community?tab=leaderboard&board=all" className={all ? "text-accent underline underline-offset-4" : "text-dim"}>All time</Link>
        </div>
        <ol className="space-y-1.5">
          {list.map((r, i) => (
            <li key={r.client_id} className={`flex items-center gap-3 rounded-xl border p-3 ${r.client_id === user!.id ? "border-accent bg-accent/10" : "border-border bg-card"}`}>
              <span className={`w-7 text-center font-[family-name:var(--font-display)] text-xl ${i < 3 ? "text-gold" : "text-dim"}`}>{i + 1}</span>
              <span className="flex-1">{shortName(r.full_name)}{r.client_id === user!.id ? " (you)" : ""}</span>
              <span className="font-[family-name:var(--font-display)] text-lg">{r.cps} <span className="text-xs text-dim">CPs</span></span>
            </li>
          ))}
          {!list.length && <p className="text-dim">No points yet this week. Check off a habit to get on the board.</p>}
        </ol>
        {!all && <p className="text-center text-xs text-dim">Resets every Monday, so anyone can top the board.</p>}
      </section>
    );
  }

  const { data: posts } = await supabase.from("posts").select("id, author_id, body, photo_path, pinned, created_at")
    .order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(50);
  const ids = (posts ?? []).map((p) => p.id);
  const [{ data: comments }, { data: likes }, { data: names }] = await Promise.all([
    ids.length ? supabase.from("comments").select("id, post_id, author_id, body, created_at").in("post_id", ids).order("created_at") : { data: [] },
    ids.length ? supabase.from("likes").select("post_id, user_id").in("post_id", ids) : { data: [] },
    supabase.from("member_names").select("id, full_name, role"),
  ]);
  const name = new Map((names ?? []).map((n) => [n.id, n.full_name as string | null]));
  const coachIds = new Set((names ?? []).filter((n) => n.role === "coach").map((n) => n.id));
  const photos = new Map<string, string>();
  const paths = (posts ?? []).map((p) => p.photo_path).filter(Boolean) as string[];
  if (paths.length) {
    const { data } = await supabase.storage.from("media").createSignedUrls(paths, 3600);
    data?.forEach((d) => d.path && d.signedUrl && photos.set(d.path, d.signedUrl));
  }
  const who = (id: string) => (coachIds.has(id) ? "Michael (Coach)" : shortName(name.get(id)));

  return (
    <section className="space-y-4">
      <LiveRefresh tables={["posts", "comments", "likes"]} />
      {header}{Tabs}
      <Composer userId={user!.id} coach={coach} />
      {(posts ?? []).map((p) => {
        const cs = (comments ?? []).filter((c) => c.post_id === p.id);
        const ls = (likes ?? []).filter((l) => l.post_id === p.id);
        const mine = p.author_id === user!.id;
        return (
          <article key={p.id} className={`space-y-2 rounded-2xl border bg-card p-3.5 ${p.pinned ? "border-accent" : "border-border"}`}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm"><b className={coachIds.has(p.author_id) ? "text-accent" : ""}>{who(p.author_id)}</b>
                <span className="text-dim"> · {timeAgo(p.created_at)}</span>{p.pinned && <span className="text-xs text-accent"> · Pinned</span>}</p>
              <span className="flex">
                {coach && <PinButton id={p.id} pinned={p.pinned} />}
                {(mine || coach) && <DeleteButton kind="post" id={p.id} />}
              </span>
            </div>
            {p.body && <p className="whitespace-pre-line text-[15px]">{p.body}</p>}
            {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL */}
            {p.photo_path && photos.get(p.photo_path) && <img src={photos.get(p.photo_path)} alt="" className="w-full rounded-xl" />}
            <div className="flex items-center gap-3 border-t border-border pt-1">
              <LikeButton postId={p.id} liked={ls.some((l) => l.user_id === user!.id)} count={ls.length} />
              <span className="text-sm text-dim">{cs.length ? `${cs.length} comment${cs.length > 1 ? "s" : ""}` : ""}</span>
            </div>
            {cs.length > 0 && (
              <ul className="space-y-1.5">
                {cs.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-2 text-sm">
                    <p><b className={coachIds.has(c.author_id) ? "text-accent" : ""}>{who(c.author_id)}</b> {c.body}</p>
                    {(c.author_id === user!.id || coach) && <DeleteButton kind="comment" id={c.id} />}
                  </li>
                ))}
              </ul>
            )}
            <CommentBox postId={p.id} />
          </article>
        );
      })}
      {!posts?.length && <p className="text-dim">No posts yet. Be the first: share a win from this week.</p>}
    </section>
  );
}
