// app/boop/mini-v2/layout.tsx
import React, { Suspense } from "react";
import BottomTabs from "./components/BottomTabs";
import TopBar from "./components/TopBar";

export default function MiniV2Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#07070A] text-white">
      <div className="mx-auto max-w-[520px] px-4 pt-4 pb-[92px] space-y-4">
        {/* ✅ اگر TopBar یا بچه‌هاش از useSearchParams استفاده کنن، Build نمی‌ترکه */}
        <Suspense fallback={null}>
          <TopBar
            title="Miniapp"
            subtitle="Earn daily with BOOP • Stake • Level up • Boost rewards"
          />
        </Suspense>

        {/* ✅ هر صفحه (از جمله boost) */}
        {children}
      </div>

      {/* ✅ اگر BottomTabs از useSearchParams استفاده کنه، Build نمی‌ترکه */}
      <Suspense fallback={null}>
        <BottomTabs />
      </Suspense>
    </div>
  );
}
