import type { Metadata } from "next";
import "./globals.css";
import { ClientLayout } from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "radikoRec",
  description: "radiko 録音システム",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "radikoRec",
  },
  icons: {
    apple: "/apple-touch-icon.png",
    icon: "/icon-512.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="bg-white text-slate-900">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}

