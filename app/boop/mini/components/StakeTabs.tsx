"use client";

import { useState } from "react";

type StakeTabsProps = {
  activeTab?: "stake" | "positions";
  onChange?: (tab: "stake" | "positions") => void;
};

export default function StakeTabs({
  activeTab = "stake",
  onChange,
}: StakeTabsProps) {
  const [tab, setTab] = useState<"stake" | "positions">(activeTab);

  function switchTab(next: "stake" | "positions") {
    setTab(next);
    onChange?.(next);
  }

  return (
    <div className="mb-4">
      <div className="flex gap-2 rounded-xl bg-slate-900 p-1">
        <button
          onClick={() => switchTab("stake")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm transition ${
            tab === "stake"
              ? "bg-yellow-400 text-black"
              : "text-slate-300 hover:text-white"
          }`}
        >
          Stake
        </button>

        <button
          onClick={() => switchTab("positions")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm transition ${
            tab === "positions"
              ? "bg-yellow-400 text-black"
              : "text-slate-300 hover:text-white"
          }`}
        >
          Positions
        </button>
      </div>
    </div>
  );
}
