"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  label: string;
  icon?: React.ReactNode;
};

const TABS: Tab[] = [
  { href: "/boop/mini-v2", label: "Home" },
  { href: "/boop/mini-v2/stake", label: "Stake" },
  { href: "/boop/mini-v2/boost", label: "Boost" },
  { href: "/boop/mini-v2/leaderboard", label: "Rank" },
];

function getFidFromUrl(): number {
  if (typeof window === "undefined") return 0;
  try {
    const u = new URL(window.location.href);
    return Number(u.searchParams.get("fid") || 0);
  } catch {
    return 0;
  }
}

function withFid(href: string, fid: number) {
  if (!fid) return href;
  return `${href}?fid=${fid}`;
}

export default function BottomTabs() {
  const pathname = usePathname();

  // ✅ بدون useSearchParams: fid بعد از mount از URL خوانده می‌شود
  const [fid, setFid] = useState<number>(0);

  useEffect(() => {
    setFid(getFidFromUrl());
    // هر بار route عوض شد دوباره بخوان (برای وقتی کاربر بین تب‌ها می‌چرخه)
  }, [pathname]);

  const tabs = useMemo(() => {
    return TABS.map((t) => ({
      ...t,
      hrefWithFid: withFid(t.href, fid),
      isActive: pathname === t.href,
    }));
  }, [fid, pathname]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-[520px] px-4 pb-4">
        <div className="rounded-3xl border border-white/10 bg-black/60 backdrop-blur-md">
          <div className="grid grid-cols-4">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.hrefWithFid}
                className={[
                  "py-3 text-center text-xs font-semibold transition",
                  t.isActive ? "text-yellow-300" : "text-white/60 hover:text-white/80",
                ].join(" ")}
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
