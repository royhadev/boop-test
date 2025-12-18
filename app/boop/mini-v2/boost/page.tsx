"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import GoldButton from "../components/GoldButton";

type RewardStatus = {
  ok: boolean;
  fid: number;
  totalStaked: number;
  totalUnclaimed: number;
  canClaim: boolean;
  nextClaimInSeconds: number;
  lastClaimAt: string | null;
  dailyStreak: number;
  withdrawable: number;
  feePercent: number;
  nftActive: boolean;
  boostActive: boolean;
  boostEndsAt?: string | null;
  apr: {
    totalApr: number;
    components: { base: number; level: number; streak: number; boost: number; nft: number };
  };
  error?: string;
};

const NFT_USD_PRICE_MONTH1 = 100;
const NFT_APR_BONUS_PERCENT = 20;

const BOOSTS = [
  { kind: "BOOST_24H" as const, title: "24H Boost", desc: "+20% APR for 24h", days: 1, priceUsd: 1 },
  { kind: "BOOST_72H" as const, title: "72H Boost", desc: "+20% APR for 72h", days: 3, priceUsd: 3 },
  { kind: "BOOST_7D" as const, title: "7D Boost", desc: "+20% APR for 7 days", days: 7, priceUsd: 7 },
  { kind: "SUPERBOOST_30D" as const, title: "SuperBoost", desc: "Stronger boost (30 days)", days: 30, priceUsd: 25 },
];

function fmt(n: number, d = 2) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  return x.toLocaleString(undefined, { maximumFractionDigits: d });
}

export default function BoostPage() {
  const router = useRouter();

  // ✅ fid را فقط بعد از mount از URL می‌خوانیم (بدون useSearchParams)
  const [fid, setFid] = useState<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    setFid(Number(u.searchParams.get("fid") || 0));
  }, []);

  const [loading, setLoading] = useState(true);
  const [busyKind, setBusyKind] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reward, setReward] = useState<RewardStatus | null>(null);

  const activeKind = useMemo(() => {
    if (!reward?.boostActive) return null;
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("boop_active_boost_kind");
  }, [reward?.boostActive]);

  async function load() {
    if (!fid) return;

    try {
      setLoading(true);
      setErr(null);

      const r = await fetch(`/api/reward/status?fid=${fid}&ts=${Date.now()}`, { cache: "no-store" });
      const j = (await r.json()) as RewardStatus;

      if (!r.ok || !j?.ok) throw new Error((j as any)?.error || "Failed to load reward status");

      setReward(j);
    } catch (e: any) {
      setErr(e?.message || "Load error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!fid) return;
    load();
    const t = setInterval(load, 12000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fid]);

  async function activateBoost(kind: string) {
    if (!fid) return;

    try {
      setBusyKind(kind);
      setErr(null);

      const res = await fetch(`/api/boost/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fid, kind }),
      });

      const j = await res.json();
      if (!res.ok || j?.error) throw new Error(j?.error || "Activate failed");

      if (typeof window !== "undefined") {
        window.localStorage.setItem("boop_active_boost_kind", kind);
      }

      await load();
    } catch (e: any) {
      setErr(e?.message || "Activate error");
    } finally {
      setBusyKind(null);
    }
  }

  async function buyNft() {
    if (!fid) return;

    try {
      setBusyKind("NFT");
      setErr(null);

      const res = await fetch(`/api/tx/nft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fid }),
      });

      const j = await res.json();
      if (!res.ok || j?.error) throw new Error(j?.error || "NFT request failed");

      await load();
      router.push(`/boop/mini-v2?fid=${fid}`);
    } catch (e: any) {
      setErr(e?.message || "NFT error");
    } finally {
      setBusyKind(null);
    }
  }

  const boostLocked = !!reward?.boostActive;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Boost & NFT</div>
            <div className="text-xs text-white/60">UI + wiring (payment in BOOP comes next)</div>
          </div>
          <div className="text-xs text-white/50">{loading ? "Loading..." : "Live"}</div>
        </div>
      </div>

      {!fid ? (
        <div className="rounded-3xl border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-200">
          Missing fid in URL. Open like: <span className="font-mono">/boop/mini-v2/boost?fid=123</span>
        </div>
      ) : null}

      {err ? (
        <div className="rounded-3xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      {/* Status */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Your Status</div>
          <div className="text-xs text-white/50">FID: {fid || "—"}</div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-white/60">Total APR</div>
            <div className="mt-1 text-xl font-semibold">{fmt(reward?.apr?.totalApr || 0)}%</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-white/60">Total Staked</div>
            <div className="mt-1 text-xl font-semibold">{fmt(reward?.totalStaked || 0, 0)} BOOP</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-white/60">Boost</div>
            <div className={`mt-1 text-base font-semibold ${reward?.boostActive ? "text-yellow-300" : ""}`}>
              {reward?.boostActive ? "Active ✅" : "Inactive"}
            </div>
            {reward?.boostActive && reward?.boostEndsAt ? (
              <div className="mt-1 text-[11px] text-white/55">
                Boost ends at: {new Date(reward.boostEndsAt).toLocaleString()}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-white/60">NFT</div>
            <div className={`mt-1 text-base font-semibold ${reward?.nftActive ? "text-yellow-300" : ""}`}>
              {reward?.nftActive ? "Owned ✅" : "Not owned"}
            </div>
            <div className="mt-1 text-[11px] text-white/55">APR bonus: +{NFT_APR_BONUS_PERCENT}%</div>
          </div>
        </div>
      </div>

      {/* Boosts */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Boosts</div>
            <div className="text-xs text-white/55">Temporarily increase APR</div>
          </div>
          <div className="text-[11px] text-white/50">Price shown in USD</div>
        </div>

        <div className="mt-3 space-y-3">
          {BOOSTS.map((b) => {
            const isActiveRow =
              reward?.boostActive && (activeKind ? activeKind === b.kind : b.kind === "BOOST_24H");

            const disabled = boostLocked || busyKind !== null;

            return (
              <div
                key={b.kind}
                className={[
                  "rounded-3xl border p-3",
                  isActiveRow ? "border-yellow-400/40 bg-yellow-400/10" : "border-white/10 bg-black/20",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold">{b.title}</div>
                      {isActiveRow ? (
                        <span className="rounded-full bg-yellow-400/20 px-2 py-0.5 text-[10px] font-semibold text-yellow-200">
                          ACTIVE
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-1 text-xs text-white/60">{b.desc}</div>

                    <div className="mt-2 text-[11px] text-white/55">
                      ${b.priceUsd} • {b.days} {b.days === 1 ? "day" : "days"} • paid in BOOP (next step)
                    </div>

                    {boostLocked && !isActiveRow ? (
                      <div className="mt-2 text-[11px] text-white/55">
                        When a Boost is active, other boosts are locked until it expires.
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="text-xs text-white/60 text-right">
                      Price
                      <div className="text-sm font-semibold text-white">${b.priceUsd}</div>
                    </div>

                    <div className="w-[150px]">
                      <GoldButton onClick={() => activateBoost(b.kind)} disabled={disabled || isActiveRow || !fid}>
                        {isActiveRow ? "Active" : busyKind === b.kind ? "..." : "Activate"}
                      </GoldButton>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* NFT */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">NFT</div>
            <div className="text-xs text-white/55">Permanent APR bonus</div>
          </div>
          <div className="text-[11px] text-white/50">Month 1 price</div>
        </div>

        <div className="mt-3 rounded-3xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">BOOP NFT</div>
              <div className="mt-1 text-xs text-white/60">
                Adds a permanent APR bonus: <span className="font-semibold">+{NFT_APR_BONUS_PERCENT}%</span>
              </div>
              <div className="mt-2 text-[11px] text-white/55">
                Price: <span className="font-semibold">${NFT_USD_PRICE_MONTH1}</span> (shown in USD, paid in BOOP next step)
              </div>
            </div>

            <div className="w-[190px]">
              <GoldButton onClick={buyNft} disabled={!!reward?.nftActive || busyKind !== null || !fid}>
                {reward?.nftActive ? "Owned" : busyKind === "NFT" ? "..." : "Buy NFT (Next Step)"}
              </GoldButton>
            </div>
          </div>

          <div className="mt-2 text-[11px] text-white/55">
            You can change monthly price later (off-chain config). The wallet payment flow will be wired in the next step.
          </div>
        </div>
      </div>

      {/* APR Breakdown */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
        <div className="text-sm font-semibold">APR Breakdown</div>
        <div className="text-xs text-white/55">Live from reward engine</div>

        <div className="mt-3 rounded-3xl border border-white/10 bg-black/20 p-3 text-sm">
          <div className="flex items-center justify-between py-1">
            <span className="text-white/70">Base</span>
            <span>{fmt(reward?.apr?.components?.base || 0)}%</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-white/70">Level</span>
            <span>{fmt(reward?.apr?.components?.level || 0)}%</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-white/70">Streak</span>
            <span>{fmt(reward?.apr?.components?.streak || 0)}%</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-white/70">Boost</span>
            <span>{fmt(reward?.apr?.components?.boost || 0)}%</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-white/70">NFT</span>
            <span>{fmt(reward?.apr?.components?.nft || 0)}%</span>
          </div>
          <div className="mt-2 border-t border-white/10 pt-2 flex items-center justify-between font-semibold">
            <span>Total</span>
            <span>{fmt(reward?.apr?.totalApr || 0)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
