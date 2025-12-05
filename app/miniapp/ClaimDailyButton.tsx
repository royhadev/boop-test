"use client";

import { useState } from "react";

export function ClaimDailyButton() {
  const [loading, setLoading] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  const handleClick = async () => {
    try {
      setLoading(true);
      setLastMessage(null);

      const res = await fetch("/api/claim-daily", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok || data.success === false) {
        setLastMessage(data.message || "Something went wrong");
        alert(data.message || "Something went wrong");
        return;
      }

      const msg = `Claimed +${data.rewardXP} XP ✅ (New XP: ${data.newXP}, Streak: ${data.newStreak})`;
      setLastMessage(msg);
      alert(msg);
    } catch (err) {
      console.error(err);
      setLastMessage("Error in claim");
      alert("Error in claim");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
      >
        {loading ? "Claiming..." : "Daily XP Claim"}
      </button>
      {lastMessage && (
        <p className="text-[11px] text-slate-400">{lastMessage}</p>
      )}
    </div>
  );
}
