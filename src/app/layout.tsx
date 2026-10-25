import type { Metadata, Viewport } from "next";
import "@fontsource/oswald/500.css";
import "@fontsource/oswald/600.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
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
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
