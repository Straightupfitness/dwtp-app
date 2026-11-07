import type { Metadata, Viewport } from "next";
import "@fontsource/oswald/500.css";
import "@fontsource/oswald/600.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./globals.css";
import splash from "@/lib/splash.json";

export const metadata: Metadata = {
  title: "DWTP",
  description: "The Driven Woman Transformation Program",
  manifest: "/manifest.webmanifest",
  // November 7: a launch screen (logo, or Michael's photo) while the app opens from the Home Screen. Built by scripts/make-splash.mjs.
  appleWebApp: {
    capable: true, title: "DWTP", statusBarStyle: "black-translucent",
    startupImage: splash.map((s) => ({ url: s.href, media: `(device-width: ${s.w}px) and (device-height: ${s.h}px) and (-webkit-device-pixel-ratio: ${s.r}) and (orientation: portrait)` })),
  },
  icons: { icon: "/brand/icon-192.png", apple: "/brand/apple-touch-icon.png" },
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
