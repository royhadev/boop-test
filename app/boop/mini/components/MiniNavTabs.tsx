"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/boop/mini", label: "Home" },
  { href: "/boop/mini/stake", label: "Stake" },
  { href: "/boop/mini/withdraw", label: "Withdraw" },
  { href: "/boop/mini/leaderboard", label: "Leaderboard" },
];

export function MiniNavTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-2 flex items-center gap-1 rounded-2xl border bg-white/60 p-1 text-xs">
      {TABS.map((tab) => {
        const active = pathname === tab.href;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 rounded-xl px-2 py-1 text-center ${
              active
                ? "bg-black text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
