// app/boop/mini-v2/styles/theme.ts

export const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export const theme = {
  radius: {
    card: "rounded-2xl",
    button: "rounded-xl",
    pill: "rounded-full",
  },

  surface: {
    page: "bg-[#07070A] text-white",
    card: "bg-white/5 backdrop-blur-md border border-white/10",
    cardSoft: "bg-white/[0.035] backdrop-blur-md border border-white/10",
    inset: "bg-black/30 border border-white/10",
  },

  text: {
    title: "text-[15px] font-semibold tracking-tight",
    subtitle: "text-[12px] text-white/70",
    value: "text-[22px] font-bold tracking-tight",
    label: "text-[12px] text-white/60",
    hint: "text-[11px] text-white/55",
  },

  gold: {
    gradient: "bg-gradient-to-r from-[#FFD84D] via-[#FFC300] to-[#E6A800]",
    glow: "shadow-[0_0_25px_rgba(255,200,0,0.45)]",
    text: "text-black",
    border: "border border-black/10",
  },

  shadow: {
    card: "shadow-[0_10px_30px_rgba(0,0,0,0.35)]",
    soft: "shadow-[0_8px_22px_rgba(0,0,0,0.25)]",
  },

  button: {
    base:
      "select-none inline-flex items-center justify-center gap-2 font-semibold transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed",
    size: {
      md: "h-12 px-5 text-[14px]",
      sm: "h-10 px-4 text-[13px]",
    },
    dark:
      "bg-white/8 hover:bg-white/10 border border-white/10 text-white shadow-[0_10px_24px_rgba(0,0,0,0.28)]",
  },

  brand: {
    logo: "/brand/boop-app-logo.png",
    poster: "/brand/boopposter.jpg",
  },
} as const;
