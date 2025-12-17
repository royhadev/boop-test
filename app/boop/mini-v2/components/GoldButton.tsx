"use client";

import React from "react";

type GoldButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  full?: boolean;
  loading?: boolean;
  loadingText?: string;
};

export default function GoldButton({
  full = true,
  loading = false,
  loadingText = "Processing...",
  disabled,
  children,
  className = "",
  ...props
}: GoldButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={[
        "relative overflow-hidden",
        full ? "w-full" : "",
        "py-4 rounded-2xl font-bold text-[16px] text-black",
        // ✅ Gold Gradient (قفل/مرجع)
        "bg-gradient-to-r from-[#FFD84D] via-[#FFC300] to-[#E6A800]",
        // ✅ Glow
        "shadow-[0_0_25px_rgba(255,200,0,0.45)]",
        // ✅ Hover / Active
        "hover:brightness-[1.06] active:brightness-[0.98] active:scale-[0.99]",
        "transition-all duration-200",
        // ✅ Disabled
        "disabled:opacity-60 disabled:shadow-none disabled:cursor-not-allowed",
        className,
      ].join(" ")}
    >
      {/* subtle shine */}
      <span className="pointer-events-none absolute inset-0 opacity-35">
        <span className="absolute -left-10 top-0 h-full w-24 rotate-12 bg-white/40 blur-md" />
      </span>

      <span className="relative z-10 inline-flex items-center justify-center gap-2">
        {loading ? (
          <>
            <Spinner />
            <span className="opacity-90">{loadingText}</span>
          </>
        ) : (
          children
        )}
      </span>
    </button>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 rounded-full border-2 border-black/40 border-t-black/80 animate-spin" />
  );
}
