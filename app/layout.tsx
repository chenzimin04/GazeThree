import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AmbientEcho",
  description: "面向中文用户的沉浸式 AI 英语陪练。",
  applicationName: "AmbientEcho",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AmbientEcho",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#050816",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-dvh bg-[#050816] text-zinc-100 antialiased">
        <div className="relative min-h-dvh overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_28%),radial-gradient(circle_at_bottom,_rgba(168,85,247,0.12),_transparent_24%),linear-gradient(180deg,_#04070f_0%,_#050816_48%,_#02040a_100%)]">
          <div className="pointer-events-none absolute inset-0 opacity-[0.14] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:40px_40px]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_38%,rgba(0,0,0,0.42)_100%)]" />
          <div className="relative z-10 min-h-dvh">{children}</div>
        </div>
      </body>
    </html>
  );
}
