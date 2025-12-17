"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";

type Tab = {
  key: string;
  label: string;
  icon: string;
  href: (fid?: string) => string;
  active: (pathname: string) => boolean;
};

export default function BottomTabs() {
  const pathname = usePathname();
  const params = useSearchParams();

  const fid = params?.get("fid") ?? "";

  // ✅ ترتیب جدید: Home → Stake → Boost → Withdraw → Board
  const tabs: Tab[] = useMemo(
    () => [
      {
        key: "home",
        label: "Home",
        icon: "🏠",
        href: (f) => `/boop/mini-v2${f ? `?fid=${f}` : ""}`,
        active: (p) => p === "/boop/mini-v2",
      },
      {
        key: "stake",
        label: "Stake",
        icon: "🧱",
        href: (f) => `/boop/mini-v2/stake${f ? `?fid=${f}` : ""}`,
        active: (p) => p.startsWith("/boop/mini-v2/stake"),
      },
      {
        key: "boost",
        label: "Boost",
        icon: "⚡️",
        href: (f) => `/boop/mini-v2/boost${f ? `?fid=${f}` : ""}`,
        active: (p) => p.startsWith("/boop/mini-v2/boost"),
      },
      {
        key: "withdraw",
        label: "Withdraw",
        icon: "💸",
        href: (f) => `/boop/mini-v2/withdraw${f ? `?fid=${f}` : ""}`,
        active: (p) => p.startsWith("/boop/mini-v2/withdraw"),
      },
      {
        key: "board",
        label: "Board",
        icon: "🏆",
        href: (f) => `/boop/mini-v2/leaderboard${f ? `?fid=${f}` : ""}`,
        active: (p) => p.startsWith("/boop/mini-v2/leaderboard"),
      },
    ],
    []
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-[520px] px-3 pb-3">
        <div className="rounded-3xl border border-white/10 bg-black/60 backdrop-blur-md p-2 shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
          <div className="grid grid-cols-5 gap-2">
            {tabs.map((tab) => {
              const isActive = tab.active(pathname || "");

              return (
                <Link
                  key={tab.key}
                  href={tab.href(fid)}
                  className={[
                    "relative h-[54px] rounded-2xl",
                    "flex flex-col items-center justify-center gap-0.5",
                    "transition-all duration-200 select-none",
                    isActive
                      ? "bg-gradient-to-r from-[#FFD84D] via-[#FFC300] to-[#E6A800] text-black shadow-[0_0_18px_rgba(255,200,0,0.4)]"
                      : "bg-white/[0.04] border border-white/10 text-white/70 hover:bg-white/[0.06]",
                  ].join(" ")}
                >
                  {isActive && (
                    <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl opacity-30">
                      <span className="absolute -left-10 top-0 h-full w-24 rotate-12 bg-white/40 blur-md" />
                    </span>
                  )}

                  <span className="relative z-10 text-[16px] leading-none">
                    {tab.icon}
                  </span>
                  <span className="relative z-10 text-[11px] font-semibold leading-none">
                    {tab.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="h-2" />
    </div>
  );
}
