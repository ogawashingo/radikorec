import type { Metadata } from "next";
import "./globals.css";
import { ClientLayout } from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "RadikoRec",
  description: "Radiko Recording System via CLI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="dark">
      <body className="bg-slate-950">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}

