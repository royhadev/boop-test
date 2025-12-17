"use client";

import React from "react";

type BoopButtonVariant = "gold" | "goldOutline" | "dark";

type Props = {
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  className?: string;
  variant?: BoopButtonVariant;
  type?: "button" | "submit" | "reset";
};

const base =
  "w-full select-none rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-150 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed";

const styles: Record<BoopButtonVariant, { className: string; style?: React.CSSProperties }> = {
  gold: {
    className: `${base} text-[#1A1A1A]`,
    style: {
      background:
        "linear-gradient(180deg, #FFD76A 0%, #FFB800 45%, #E09A00 72%, #B87300 100%)",
      border: "1px solid rgba(255, 215, 120, 0.60)",
      boxShadow:
        "inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -2px 4px rgba(120,70,0,0.55), 0 0 34px rgba(255,180,0,0.78)",
    },
  },

  goldOutline: {
    className: `${base} text-[#FFCF48]`,
    style: {
      background: "rgba(255, 184, 0, 0.06)",
      border: "1px solid rgba(255, 184, 0, 0.55)",
      boxShadow: "0 0 24px rgba(255,180,0,0.25)",
    },
  },

  dark: {
    className: `${base} text-white`,
    style: {
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      boxShadow: "0 0 18px rgba(0,0,0,0.35)",
    },
  },
};

export default function BoopButton({
  children,
  onClick,
  disabled,
  className = "",
  variant = "gold",
  type = "button",
}: Props) {
  // ✅ crash-proof: اگر جایی اشتباهاً variant نامعتبر پاس داده شد
  const v = styles[variant] ?? styles.gold;

  const handleEnter: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    if (disabled) return;
    if (variant !== "gold") return;
    e.currentTarget.style.filter = "brightness(1.08)";
    e.currentTarget.style.boxShadow =
      "inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -2px 4px rgba(120,70,0,0.55), 0 0 46px rgba(255,190,40,0.92)";
  };

  const handleLeave: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    if (disabled) return;
    if (variant !== "gold") return;
    e.currentTarget.style.filter = "none";
    e.currentTarget.style.boxShadow =
      "inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -2px 4px rgba(120,70,0,0.55), 0 0 34px rgba(255,180,0,0.78)";
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${v.className} ${className}`}
      style={v.style}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
    </button>
  );
}
