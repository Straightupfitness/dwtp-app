import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DWTP",
  description: "The Driven Woman Transformation Program",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "DWTP", statusBarStyle: "black-translucent" },
  icons: { icon: "/brand/dwtp-logo.png", apple: "/brand/dwtp-logo.png" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
