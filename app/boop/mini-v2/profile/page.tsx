// app/boop/mini-v2/profile/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import BoopCard from "../components/BoopCard";
import GoldButton from "../components/GoldButton";

/* ------------------ types ------------------ */
type RewardStatus = {
  ok: boolean;
  fid?: number;
  totalUnclaimed?: number;
  totalStaked?: number;
  nextClaimInSeconds?: number;
  canClaim?: boolean;
  lastClaimAt?: string | null;
  dailyStreak?: number;
  withdrawable?: number;
  nftActive?: boolean;
  boostActive?: boolean;
  apr?: {
    totalApr?: number;
    components?: {
      base?: number;
      level?: number;
      streak?: number;
      nft?: number;
      boost?: number;
    };
  };
};

type UserStatus = {
  ok: boolean;
  user?: {
    fid?: number;
    username?: string | null;
    display_name?: string | null;
    pfp?: string | null;
    xp?: number | null;
    level?: number | null;
    daily_streak?: number | null;
    custody_address?: string | null;
  };
};

type WalletStatus = {
  ok: boolean;
  fid?: number;
  address?: string | null;
  boopBalance?: number;
};

/* ------------------ utils ------------------ */
const toNum = (v: any, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const fmt = (n: number) =>
  Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 4 });

function shortAddr(a?: string | null) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/* ------------------ page ------------------ */
export default function MiniV2Profile() {
  const fid = useMemo(() => {
    if (typeof window === "undefined") return "";
    const u = new URL(window.location.href);
    return String(u.searchParams.get("fid") || "").trim();
  }, []);

  const [user, setUser] = useState<UserStatus | null>(null);
  const [reward, setReward] = useState<RewardStatus | null>(null);
  const [wallet, setWallet] = useState<WalletStatus | null>(null);

  const [copyMsg, setCopyMsg] = useState<string>("");
  const [claiming, setClaiming] = useState(false);

  /* auto-init user (idempotent) */
  useEffect(() => {
    if (!fid) return;
    fetch("/api/user/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fid: Number(fid) }),
    }).catch(() => {});
  }, [fid]);

  /* load data */
  useEffect(() => {
    if (!fid) return;

    let alive = true;

    const load = async () => {
      try {
        const [rUser, rReward, rWallet] = await Promise.all([
          fetch(`/api/user/status?fid=${fid}`, { cache: "no-store" }),
          fetch(`/api/reward/status?fid=${fid}`, { cache: "no-store" }),
          fetch(`/api/wallet/boop?fid=${fid}`, { cache: "no-store" }),
        ]);

        const jUser = await rUser.json();
        const jReward = await rReward.json();
        const jWallet = await rWallet.json();

        if (!alive) return;

        if (jUser?.ok) setUser(jUser);
        if (jReward?.ok) setReward(jReward);
        if (jWallet?.ok) setWallet(jWallet);
      } catch {
        /* ignore */
      }
    };

    load();
    const t = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [fid]);

  const username = user?.user?.display_name || user?.user?.username || "User";
  const pfp = user?.user?.pfp || "/brand/boop-app-logo.png";

  const addr = wallet?.address || user?.user?.custody_address || null;
  const walletBoop = wallet?.boopBalance ?? null;

  const xp = toNum(user?.user?.xp);
  const level = toNum(user?.user?.level);
  const streak = toNum(reward?.dailyStreak ?? user?.user?.daily_streak);

  const totalStaked = toNum(reward?.totalStaked);
  const aprTotal = toNum(reward?.apr?.totalApr);
  const breakdown = reward?.apr?.components || {};

  async function copyAddress() {
    if (!addr) return;
    try {
      await navigator.clipboard.writeText(addr);
      setCopyMsg("Copied ✓");
      setTimeout(() => setCopyMsg(""), 1200);
    } catch {
      setCopyMsg("Copy failed");
      setTimeout(() => setCopyMsg(""), 1200);
    }
  }

  async function claimDaily() {
    if (!fid || !reward?.canClaim) return;
    setClaiming(true);
    try {
      let res = await fetch("/api/reward/claim-daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fid: Number(fid) }),
      });

      if (!res.ok) {
        await fetch("/api/reward/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fid: Number(fid) }),
        });
      }
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={pfp}
            className="w-12 h-12 rounded-2xl border border-white/10"
            alt="pfp"
          />
          <div className="min-w-0">
            <div className="font-semibold truncate">{username}</div>
            <div className="text-[12px] text-white/60">BOOP • Base • Farcaster</div>
            <div className="text-[12px] text-white/70 mt-1 flex items-center gap-2">
              <span>Wallet: {walletBoop === null ? "—" : fmt(walletBoop)} BOOP</span>
              {addr && <span className="text-white/40">{shortAddr(addr)}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {reward?.nftActive && (
            <span className="px-2 py-1 rounded-lg text-[11px] border border-yellow-400/25 bg-yellow-400/10 text-yellow-200">
              NFT ON
            </span>
          )}
          {reward?.boostActive && (
            <span className="px-2 py-1 rounded-lg text-[11px] border border-yellow-400/25 bg-yellow-400/10 text-yellow-200">
              BOOST ON
            </span>
          )}
        </div>
      </div>

      {/* Wallet */}
      <BoopCard title="Wallet">
        <div className="text-[13px] text-white/70">BOOP Balance</div>
        <div className="text-3xl font-bold mt-1">
          {walletBoop === null ? "—" : fmt(walletBoop)}{" "}
          <span className="text-xl text-white/70">BOOP</span>
        </div>

        <div className="mt-3 text-[12px] text-white/60 break-all">Address: {addr || "—"}</div>

        <div className="mt-3 flex items-center gap-2">
          <GoldButton onClick={copyAddress} disabled={!addr}>
            Copy Address
          </GoldButton>
          {copyMsg && <span className="text-[12px] text-white/70">{copyMsg}</span>}
        </div>

        <div className="mt-2 text-[11px] text-white/45">
          Wallet is derived from Farcaster custody (no manual connect needed).
        </div>
      </BoopCard>

      {/* Stats */}
      <BoopCard title="Your Stats">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
            <div className="text-[11px] text-white/60">Level</div>
            <div className="text-lg font-semibold">{level}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
            <div className="text-[11px] text-white/60">XP</div>
            <div className="text-lg font-semibold">{fmt(xp)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
            <div className="text-[11px] text-white/60">Streak</div>
            <div className="text-lg font-semibold">{streak}</div>
          </div>
        </div>
      </BoopCard>

      {/* Stake + APR */}
      <BoopCard title="Stake & APR">
        <div className="text-[12px] text-white/60">Total Staked</div>
        <div className="text-2xl font-bold mt-1">{fmt(totalStaked)} BOOP</div>

        <div className="text-[12px] text-white/60 mt-4">Total APR</div>
        <div className="text-2xl font-bold mt-1">{aprTotal.toFixed(2)}%</div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
          <div>Base: {toNum(breakdown.base).toFixed(2)}%</div>
          <div>Level: {toNum(breakdown.level).toFixed(2)}%</div>
          <div>Streak: {toNum(breakdown.streak).toFixed(2)}%</div>
          <div>NFT: {toNum(breakdown.nft).toFixed(2)}%</div>
          <div>Boost: {toNum(breakdown.boost).toFixed(2)}%</div>
        </div>
      </BoopCard>

      {/* Quick Actions */}
      <BoopCard title="Quick Actions">
        <div className="text-[12px] text-white/60">
          Daily Claim is normally done from Home. (Optional: you can also do it here.)
        </div>

        <div className="mt-3">
          <GoldButton onClick={claimDaily} disabled={!reward?.canClaim || claiming}>
            {claiming ? "..." : reward?.canClaim ? "Claim Now" : "Claim Locked"}
          </GoldButton>
        </div>

        <div className="mt-2 text-[11px] text-white/45">Claim fee: 2%</div>
      </BoopCard>
    </div>
  );
}
