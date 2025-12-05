import type { Metadata } from "next";
import "./globals.css";
import { NeynarProvider } from "@/components/NeynarProvider";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "BOOP Miniapp",
  description:
    "BOOP – Gamified Miniapp on Base with XP, Levels, Missions, and Seasonal Rewards.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-50">
        <NeynarProvider>
          <div className="min-h-screen flex flex-col">
            <Header />

            <main className="flex-1 px-4 py-6 max-w-3xl mx-auto w-full">
              {children}
            </main>

            <footer className="border-t border-slate-800 px-4 py-3 text-xs text-slate-400 text-center">
              BOOP on Base · XP • Levels · Missions · Rewards
            </footer>
          </div>
        </NeynarProvider>
      </body>
    </html>
  );
}
