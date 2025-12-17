// app/boop/mini-v2/_ui/theme.ts
export const V2 = {
  // Yellow (stronger)
  yellowText: "text-yellow-300",
  yellowTextStrong: "text-yellow-200",
  yellowBorder: "border-yellow-300",
  yellowBg: "bg-yellow-400/20",

  // Base UI
  pageWrap: "min-h-screen bg-black text-white",
  container: "mx-auto max-w-xl px-4 pb-24 pt-6",
  card:
    "rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]",
  cardSoft: "rounded-2xl border border-white/10 bg-white/3 p-4",
  title: "text-xl font-semibold tracking-tight",
  subtitle: "text-sm text-white/60",

  // Buttons
  primaryBtn:
    "w-full rounded-xl px-4 py-3 font-semibold border transition active:scale-[0.99] " +
    "border-yellow-300 bg-yellow-400/20 text-yellow-200 hover:bg-yellow-400/25",
  secondaryBtn:
    "w-full rounded-xl px-4 py-3 font-semibold border transition active:scale-[0.99] " +
    "border-white/12 bg-white/5 text-white/80 hover:bg-white/8",

  // Tabs
  tabBar:
    "fixed bottom-0 left-0 right-0 border-t border-white/10 bg-black/80 backdrop-blur supports-[backdrop-filter]:bg-black/60",
  tabInner: "mx-auto max-w-xl px-3 py-2",
  tabGrid: "grid grid-cols-5 gap-2",
  tabItemBase:
    "flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 border transition",
  tabItemActive: "border-yellow-300 bg-yellow-400/20 text-yellow-200",
  tabItemIdle: "border-white/10 bg-white/5 text-white/65 hover:bg-white/8",
  tabIcon: "h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold",
  tabLabel: "text-[11px] leading-none",
};
