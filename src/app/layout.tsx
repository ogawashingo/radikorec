import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

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
      <body className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans antialiased">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-8 relative">
          <div className="absolute inset-0 bg-slate-950 -z-10" />
          {/* Subtle gradient blobb */}
          <div className="absolute top-0 left-0 w-full h-96 bg-blue-900/10 blur-[100px] rounded-full -z-10 pointer-events-none" />

          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
