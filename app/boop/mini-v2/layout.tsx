// app/boop/mini-v2/layout.tsx
import React from "react";
import BottomTabs from "./components/BottomTabs";
import TopBar from "./components/TopBar";

export default function MiniV2Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#07070A] text-white">
      <div className="mx-auto max-w-[520px] px-4 pt-4 pb-[92px] space-y-4">
        <TopBar
          title="Miniapp"
          subtitle="Earn daily with BOOP"
          description="Stake • Level up • Boost rewards"
        />
        {children}
      </div>

      {/* Bottom Tabs */}
      <BottomTabs />
    </div>
  );
}
