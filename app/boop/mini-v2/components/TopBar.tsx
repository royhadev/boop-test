"use client";

import React from "react";
import { theme } from "../styles/theme";

export default function TopBar({
  title = "BOOP",
  subtitle = "Stake • Earn • Level Up",
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] min-h-[86px]">
      {/* ✅ Wordmark background (smaller) */}
      <div
        className="absolute inset-0 opacity-90"
        style={{
          backgroundImage: `url(/brand/boopapp-wordmark.jpg)`,
          backgroundRepeat: "no-repeat",
          backgroundSize: "68%", // 👈 کوچیک‌تر شد (اگر خواستی 70% کن)
          backgroundPosition: "center",
        }}
      />

      {/* Overlay (keeps content readable + makes it look intentional) */}
      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-black/60" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />

      <div className="relative z-10 p-4 flex items-center gap-3">
        {/* Logo box */}
        <div className="h-11 w-11 rounded-2xl bg-white/10 border border-white/10 overflow-hidden flex items-center justify-center">
          <img
            src={theme.brand.logo}
            alt="BOOP"
            className="h-9 w-9 object-contain"
          />
        </div>

        {/* Text */}
        <div className="min-w-0">
          <div className="text-[15px] font-semibold truncate">{title}</div>
          <div className="text-[12px] text-white/70 truncate">{subtitle}</div>
        </div>

        {/* Right tag */}
        <div className="ml-auto text-[11px] text-white/60 flex items-center gap-2">
          <span className="inline-flex items-center gap-1">
            <span className="opacity-80">Base</span> <span>⚡</span>
          </span>
          <span className="text-white/35">•</span>
          <span className="opacity-85">Farcaster</span>
        </div>
      </div>
    </div>
  );
}
