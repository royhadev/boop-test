"use client";

import { useNeynarContext } from "@neynar/react";

export function FarcasterUserStatus() {
  const { user } = useNeynarContext();

  // اگر هنوز لاگین نشده
  if (!user) {
    return (
      <div className="mt-4 text-sm text-slate-300">
        You are browsing as{" "}
        <span className="font-semibold">guest</span>.{" "}
        Click <span className="font-semibold">Sign in with Neynar</span> in the
        top-right to connect your Farcaster account.
      </div>
    );
  }

  // اگر لاگین شده
  return (
    <div className="mt-4 rounded-xl border border-violet-500/40 bg-slate-900/60 px-4 py-3 text-sm">
      <div className="font-semibold text-violet-300">
        Connected Farcaster account
      </div>
      <div className="mt-1 space-y-1">
        <div>
          Username:{" "}
          <span className="font-mono">@{user.username}</span>
        </div>
        <div>Display name: {user.display_name}</div>
        <div className="text-xs text-slate-400">
          FID: {user.fid}
        </div>
      </div>
    </div>
  );
}
