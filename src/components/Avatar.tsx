import { avatarUrl } from "@/lib/avatar";

/** Her profile picture, or her initial in a circle. Michael's initial circle is gold. */
export default function Avatar({ name, path, size = 36, coach = false }: { name?: string | null; path?: string | null; size?: number; coach?: boolean }) {
  const url = avatarUrl(path);
  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- public Supabase URL
    return <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span aria-hidden="true" className="grid shrink-0 place-items-center rounded-full font-[family-name:var(--font-display)]"
      style={{ width: size, height: size, fontSize: size * 0.45, background: coach ? "#f5a623" : "#2a2a2a", color: coach ? "#0a0a0a" : "#f5f5f5" }}>
      {initial}
    </span>
  );
}
