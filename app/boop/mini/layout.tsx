import type { ReactNode } from "react";
import NavBar from "./components/NavBar";

export default function MiniLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Page container */}
      <div className="max-w-xl mx-auto p-4 space-y-4">
        {/* Top Navigation */}
        <NavBar />

        {/* Main content card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          {children}
        </div>

        {/* Footer */}
        <div className="pt-6 text-center text-xs opacity-50">
          BOOP on Base • XP • Levels • Missions • Rewards
        </div>
      </div>
    </div>
  );
}
