"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BoopCard from "./components/BoopCard";
import GoldButton from "./components/GoldButton";

/* ------------------ types ------------------ */
type RewardStatus = {
  ok: boolean;
  totalUnclaimed?: number;
  totalStaked?: number;
  nextClaimInSeconds?: number;
  canClaim?: boolean;
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
  ok?: boolean;
  user?: {
    username?: string;
    pfp?: string;
    level?: number;
    xp?: number;
    daily_streak?: number;
  };
};

type WalletStatus = {
  ok?: boolean;
  boopBalance?: number | string;
  address?: string | null;
};

/* ------------------ utils ------------------ */
const toNum = (v: any, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const fmt = (n: number) =>
  Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 4 });

const fmtSeconds = (sec: number) => {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}h ${m}m ${r}s`;
  if (m > 0) return `${m}m ${r}s`;
  return `${r}s`;
};

// fetch with timeout + no-store (safe: never throws AbortError to React)
async function fetchJson(url: string, timeoutMs = 7000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });

    let j: any = null;
    try {
      j = await res.json();
    } catch {
      // non-json response (e.g. 404 html) -> keep j = null
      j = null;
    }

    return { ok: res.ok, status: res.status, json: j };
  } catch (e: any) {
    // IMPORTANT: swallow AbortError so it doesn't crash the page
    if (e?.name === "AbortError") {
      return { ok: false, status: 0, json: null, aborted: true };
    }
    // other errors also shouldn't crash UI
    return { ok: false, status: 0, json: null, error: e?.message || "fetch error" };
  } finally {
    clearTimeout(t);
  }
}

/* ------------------ page ------------------ */
export default function MiniV2Home() {
  // fid only after mount
  const [fid, setFid] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    setFid(String(u.searchParams.get("fid") || "").trim());
  }, []);

  const [reward, setReward] = useState<RewardStatus | null>(null);
  const [user, setUser] = useState<UserStatus | null>(null);

  const [walletBoop, setWalletBoop] = useState<number | null>(null);
  const [walletAddr, setWalletAddr] = useState<string | null>(null);

  const [claiming, setClaiming] = useState(false);
  const [copying, setCopying] = useState(false);

  const isClaimingRef = useRef(false);
  const [coreLoading, setCoreLoading] = useState(false);

  /* -------- init user -------- */
  useEffect(() => {
    if (!fid) return;
    fetch("/api/user/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fid: Number(fid) }),
      cache: "no-store",
    }).catch(() => {});
  }, [fid]);

  /* -------- loaders -------- */
  const loadCore = useCallback(
    async (force = false) => {
      if (!fid) return;
      if (!force && isClaimingRef.current) return;

      setCoreLoading(true);
      const ts = Date.now();

      try {
        // give core APIs more time (they sometimes take 3-4s)
        const [rReward, rUser] = await Promise.all([
          fetchJson(`/api/reward/status?fid=${fid}&ts=${ts}`, 8000),
          fetchJson(`/api/user/status?fid=${fid}&ts=${ts}`, 8000),
        ]);

        if (rReward?.json?.ok) setReward(rReward.json);
        if (rUser?.json?.ok) setUser(rUser.json);

        // NOTE: if aborted / failed, we just keep the last good state (no crash)
      } finally {
        setCoreLoading(false);
      }
    },
    [fid]
  );

  const loadWallet = useCallback(async () => {
    if (!fid) return;
    const ts = Date.now();

    const rWallet = await fetchJson(`/api/wallet/boop?fid=${fid}&ts=${ts}`, 8000);

    // If endpoint not implemented yet (404), don't spam errors; just show —
    if (rWallet.status === 404) {
      setWalletBoop(null);
      setWalletAddr(null);
      return;
    }

    const j = rWallet.json as WalletStatus | null;
    if (j?.ok) {
      setWalletBoop(toNum(j.boopBalance, 0));
      setWalletAddr(j.address || null);
      return;
    }

    // keep previous value; but if we never had one, stay null
    if (walletBoop === null) setWalletBoop(null);
    if (walletAddr === null) setWalletAddr(null);
  }, [fid, walletBoop, walletAddr]);

  useEffect(() => {
    if (!fid) return;

    loadCore(true);
    loadWallet();

    const t1 = setInterval(() => loadCore(false), 10_000);
    const t2 = setInterval(() => loadWallet(), 30_000);

    return () => {
      clearInterval(t1);
      clearInterval(t2);
    };
  }, [fid, loadCore, loadWallet]);

  /* -------- derived -------- */
  const username = user?.user?.username || (fid ? `fid_${fid}` : "—");
  const pfp = user?.user?.pfp || "/brand/boop-app-logo.png";

  const earnedLive = Math.max(0, toNum(reward?.totalUnclaimed));
  const totalStaked = toNum(reward?.totalStaked);
  const aprTotal = toNum(reward?.apr?.totalApr);
  const per24h = totalStaked > 0 ? (totalStaked * (aprTotal / 100)) / 365 : 0;

  const breakdown = reward?.apr?.components || {};
  const canClaim = !!reward?.canClaim;
  const nextIn = toNum(reward?.nextClaimInSeconds);

  /* -------- actions -------- */
  async function claimDaily() {
    if (!fid || !canClaim || claiming) return;

    setClaiming(true);
    isClaimingRef.current = true;

    setReward((prev) =>
      prev
        ? { ...prev, canClaim: false, totalUnclaimed: 0, nextClaimInSeconds: 86400 }
        : prev
    );

    try {
      await fetch("/api/reward/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fid: Number(fid) }),
        cache: "no-store",
      });

      await loadCore(true);
      setTimeout(() => loadCore(true), 800);
    } finally {
      setClaiming(false);
      setTimeout(() => (isClaimingRef.current = false), 1200);
    }
  }

  /* ------------------ UI ------------------ */
  const refLink = fid ? `https://joinboop.xyz/?ref=${fid}` : "";
  const shareUrl = fid
    ? `https://warpcast.com/~/compose?text=${encodeURIComponent(
        `Join BOOP and earn rewards! ${refLink}`
      )}`
    : "";

  return (
    <div className="space-y-4">
      {/* Profile / Wallet */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img src={pfp} className="w-10 h-10 rounded-2xl border border-white/10" />
          <div className="min-w-0">
            <div className="font-semibold truncate">{username}</div>
            <div className="text-[12px] text-white/60">BOOP • Base • Farcaster</div>
          </div>
        </div>

        {/* Wallet BOOP (same card, no layout change) */}
        <div className="text-right">
          <div className="text-[11px] text-white/55">Wallet BOOP</div>
          <div className="text-sm font-semibold">
            {walletBoop === null ? "—" : `${fmt(walletBoop)} BOOP`}
          </div>
          {walletAddr ? (
            <div className="text-[10px] text-white/40">
              {walletAddr.slice(0, 6)}…{walletAddr.slice(-4)}
            </div>
          ) : null}
        </div>
      </div>

      {/* Referral Card */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
        <div className="font-semibold">🎁 Invite & Earn XP</div>
        <div className="text-sm text-white/70">
          Invite friends and earn <span className="text-yellow-300">200 XP</span> for each
          active referral.
        </div>
        <div className="flex gap-2">
          <button
            disabled={!fid}
            onClick={async () => {
              if (!fid || copying) return;
              setCopying(true);
              try {
                await navigator.clipboard.writeText(refLink);
              } finally {
                setTimeout(() => setCopying(false), 400);
              }
            }}
            className="flex-1 rounded-xl bg-yellow-400 text-black text-sm py-2 font-medium disabled:opacity-40"
          >
            {copying ? "Copied!" : "Copy Referral Link"}
          </button>
          <a
            href={shareUrl}
            target="_blank"
            className="flex-1 rounded-xl border border-yellow-400/40 text-yellow-300 text-sm py-2 text-center"
          >
            Share
          </a>
        </div>
      </div>

      {/* Daily Claim */}
      <BoopCard title="Daily Claim" subtitle="Updates every 10 seconds">
        <div className="text-3xl font-bold">
          {coreLoading && reward === null ? "…" : fmt(earnedLive)}{" "}
          <span className="text-xl text-white/70">BOOP</span>
        </div>
        <div className="text-[12px] text-white/60 mt-1">≈ {fmt(per24h)} BOOP / 24h</div>
        <div className="text-[12px] text-white/60 mt-1">
          {canClaim ? "Ready to claim" : `Next claim in ${fmtSeconds(nextIn)}`}
        </div>
        <div className="mt-4">
          <GoldButton onClick={claimDaily} disabled={!canClaim || claiming}>
            {claiming ? "..." : canClaim ? "Claim" : "Claim Locked"}
          </GoldButton>
        </div>
      </BoopCard>

      {/* Stake & APR */}
      <BoopCard title="Stake & APR">
        <div className="text-[12px] text-white/60">Total staked</div>
        <div className="text-2xl font-bold mt-1">{fmt(totalStaked)} BOOP</div>

        <div className="mt-4">
          <div className="text-[12px] text-white/60">Total APR</div>
          <div className="text-3xl font-bold mt-1">{aprTotal.toFixed(2)}%</div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-[12px] text-white/80">
          <div>Base: {toNum(breakdown.base).toFixed(2)}%</div>
          <div>Level: {toNum(breakdown.level).toFixed(2)}%</div>
          <div>Streak: {toNum(breakdown.streak).toFixed(2)}%</div>
          <div>NFT: {toNum(breakdown.nft).toFixed(2)}%</div>
          <div>Boost: {toNum(breakdown.boost).toFixed(2)}%</div>
        </div>
      </BoopCard>

      {/* Footer Links */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 space-y-2 text-sm">
        <div className="text-white/80 font-medium">Links</div>
        <a href="https://joinboop.xyz" target="_blank" className="block text-white/60">
          Website: joinboop.xyz
        </a>
        <a href="https://x.com/BoopApps" target="_blank" className="block text-white/60">
          X (Twitter): @BoopApps
        </a>
        <a href="https://warpcast.com/boopapp" target="_blank" className="block text-white/60">
          Farcaster: @boopapp
        </a>

        <div className="pt-2 text-white/80 font-medium">Contract & Network</div>
        <div className="text-white/60">Network: Base</div>
        <a
          href="https://basescan.org/token/0xYOUR_CONTRACT"
          target="_blank"
          className="text-white/60"
        >
          BOOP Contract (BaseScan)
        </a>
      </div>
    </div>
  );
}
