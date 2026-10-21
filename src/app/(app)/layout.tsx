import BottomNav from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="mx-auto max-w-md px-4 pb-24 pt-6">{children}</main>
      <BottomNav />
    </>
  );
}
