import Image from "next/image";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 px-4 text-center">
      <Image src="/brand/dwtp-logo.png" alt="The Driven Woman Transformation Program" width={280} height={140} priority />
      <p className="font-[family-name:var(--font-display)] text-xl uppercase tracking-widest">
        Drained <span className="text-accent">→</span> Rested <span className="text-accent">→</span> Fueled{" "}
        <span className="text-accent">→</span> Driven
      </p>
      <p className="text-dim">Your program is almost here.</p>
    </main>
  );
}
