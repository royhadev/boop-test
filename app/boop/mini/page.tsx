"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type UserStatusResp = {
  ok?: boolean;
  fid?: number;
  user?: {
    fid: number;
    username?: string | null;
    pfp?: string | null;
    xp?: number;
    level?: number;
    daily_streak?: number;
  };
  staking?: { totalStaked?: number };
  boosts?: { active?: boolean; activeBoosts?: any[] };
  nft?: { hasNft?: boolean };
  apr?: {
    totalApr?: number;
    components?: { base?: number; nft?: number; boost?: number; level?: number; streak?: number };
  };
  error?: string;
  message?: string;
};

type RewardStatusResp = {
  ok?: boolean;
  fid?: number;
  totalUnclaimed?: number;
  canClaim?: boolean;
  nextClaimInSeconds?: number;
  lastClaimAt?: string | null;
  dailyStreak?: number;
  error?: string;
  message?: string;
};

function fmt(n: number, maxFrac = 0) {
  try {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: maxFrac }).format(n);
  } catch {
    return String(n);
  }
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function secondsToHMS(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}h ${m}m ${r}s`;
  if (m > 0) return `${m}m ${r}s`;
  return `${r}s`;
}

export default function MiniHomePage() {
  const sp = useSearchParams();
  const fid = useMemo(() => {
    const v = sp.get("fid");
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [sp]);

  const [status, setStatus] = useState<UserStatusResp | null>(null);
  const [reward, setReward] = useState<RewardStatusResp | null>(null);

  const [loading, setLoading] = useState(false);
  const [claimBusy, setClaimBusy] = useState(false);
  const [err, setErr] = useState<string>("");
  const [msg, setMsg] = useState<string>("");

  // countdown + render tick
  const [nextClaimSec, setNextClaimSec] = useState<number>(0);
  const [nowMs, setNowMs] = useState<number>(Date.now());

  // freeze unclaimed for 10s after claim (UI only)
  const [freezeUntilMs, setFreezeUntilMs] = useState<number>(0);

  async function loadAll(opts?: { silent?: boolean }) {
    if (!fid) return;
    const silent = opts?.silent === true;

    if (!silent) {
      setLoading(true);
      setErr("");
      setMsg("");
    }

    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/user/status?fid=${encodeURIComponent(String(fid))}`, { method: "GET", cache: "no-store" }),
        fetch(`/api/reward/status?fid=${encodeURIComponent(String(fid))}`, { method: "GET", cache: "no-store" }),
      ]);

      const j1 = (await r1.json().catch(() => ({}))) as UserStatusResp;
      const j2 = (await r2.json().catch(() => ({}))) as RewardStatusResp;

      if (!r1.ok) throw new Error(j1?.error || j1?.message || `user/status failed`);
      if (!r2.ok) throw new Error(j2?.error || j2?.message || `reward/status failed`);

      setStatus(j1);
      setReward(j2);

      const ncs = Number(j2?.nextClaimInSeconds || 0);
      setNextClaimSec(Number.isFinite(ncs) ? Math.max(0, Math.floor(ncs)) : 0);
    } catch (e: any) {
      if (!silent) setErr(e?.message || "Failed to load");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  // initial load
  useEffect(() => {
    if (!fid) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fid]);

  // tick every 1s: countdown + nowMs (NO reward interpolation)
  useEffect(() => {
    const t = setInterval(() => {
      setNowMs(Date.now());
      setNextClaimSec((s) => (s > 0 ? s - 1 : 0));
    }, 1000);

    return () => clearInterval(t);
  }, []);

  // poll server every 10s
  useEffect(() => {
    if (!fid) return;
    const t = setInterval(() => loadAll({ silent: true }), 10_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fid]);

  async function onClaim() {
    if (!fid) return;
    if (claimBusy) return;

    setErr("");
    setMsg("");
    setClaimBusy(true);

    try {
      // freeze UI "unclaimed" for 10s to show clean reset
      setFreezeUntilMs(Date.now() + 10_000);

      const r = await fetch("/api/reward/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fid }),
      });

      const j: any = await r.json().catch(() => ({}));
      const ok = r.ok && (j?.ok === true || j?.success === true);

      if (!ok) throw new Error(j?.error || j?.message || `Claim failed (HTTP ${r.status})`);

      setMsg("Claimed ✅");

      // refresh immediately
      await loadAll({ silent: true });

      // and refresh again after 10s (back to normal polling)
      setTimeout(() => {
        loadAll({ silent: true });
      }, 10_000);
    } catch (e: any) {
      setErr(e?.message || "Claim failed");
    } finally {
      setClaimBusy(false);
    }
  }

  const username = status?.user?.username || `user_${fid}`;
  const level = Number(status?.user?.level || 0);
  const xp = Number(status?.user?.xp || 0);
  const streak = Number(status?.user?.daily_streak || reward?.dailyStreak || 0);

  const totalStaked = Number(status?.staking?.totalStaked || 0);

  const totalApr = Number(status?.apr?.totalApr || 0);
  const c = status?.apr?.components || {};
  const baseApr = Number(c.base || 0);
  const nftApr = Number(c.nft || 0);
  const boostApr = Number(c.boost || 0);
  const lvlApr = Number(c.level || 0);
  const streakApr = Number(c.streak || 0);

  const hasNft = !!status?.nft?.hasNft;
  const nftEligible = totalStaked >= 3_500_000;

  const boostActive = !!status?.boosts?.active;
  const boostEligibleSuper = totalStaked >= 3_000_000;

  const XP_L20 = 5250;
  const xpPct = clamp((xp / XP_L20) * 100, 0, 100);

  const canClaim = (reward?.canClaim ?? true) && nextClaimSec <= 0;

  const totalUnclaimedFromApi = Number(reward?.totalUnclaimed || 0);
  const showUnclaimed = nowMs < freezeUntilMs ? 0 : Math.max(0, totalUnclaimedFromApi);

  const card: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 16,
    background: "rgba(255,255,255,0.04)",
    padding: 14,
  };

  const pill: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.15)",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    opacity: 0.9,
  };

  const btn: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
    minWidth: 110,
  };

  const btnDisabled: React.CSSProperties = {
    ...btn,
    opacity: 0.45,
    cursor: "not-allowed",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0b0b10", color: "#fff" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: 14 }}>
        {!fid ? (
          <div style={{ color: "#ff6b6b" }}>
            Missing fid in URL. Use: <code>?fid=121</code>
          </div>
        ) : (
          <div style={{ ...card }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>BOOP</div>
                <div style={{ opacity: 0.75, marginTop: 2 }}>@{username}</div>

                <div style={{ marginTop: 10, opacity: 0.8, fontSize: 12 }}>Total Staked</div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{fmt(totalStaked, 0)} BOOP</div>

                <div style={{ marginTop: 6, opacity: 0.75, fontSize: 12 }}>
                  APR breakdown: {fmt(baseApr, 0)}% base • {fmt(streakApr, 0)}% streak • {fmt(lvlApr, 0)}% level •{" "}
                  {fmt(boostApr, 0)}% boost • {fmt(nftApr, 0)}% nft
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <div style={pill}>NFT: {hasNft ? "ON" : "OFF"}</div>
                  <div style={pill}>BOOST: {boostActive ? "ON" : "OFF"}</div>
                </div>

                <div style={{ marginTop: 14, opacity: 0.7, fontSize: 12 }}>Total APR</div>
                <div style={{ fontSize: 28, fontWeight: 900 }}>{fmt(totalApr, 0)}%</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 14 }}>
              <div style={{ ...card, padding: 12 }}>
                <div style={{ opacity: 0.75, fontSize: 12 }}>Level</div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{fmt(level, 0)}</div>
              </div>
              <div style={{ ...card, padding: 12 }}>
                <div style={{ opacity: 0.75, fontSize: 12 }}>XP</div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{fmt(xp, 0)}</div>
              </div>
              <div style={{ ...card, padding: 12 }}>
                <div style={{ opacity: 0.75, fontSize: 12 }}>Streak</div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>🔥 {fmt(streak, 0)}</div>
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ opacity: 0.8, fontSize: 12 }}>Progress to Level 20</div>
              <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 999, marginTop: 6 }}>
                <div
                  style={{
                    width: `${xpPct}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: "rgba(255,210,90,0.85)",
                  }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.65, marginTop: 6 }}>
                <div></div>
                <div>
                  {fmt(xp, 0)} / {fmt(XP_L20, 0)} XP
                </div>
              </div>
            </div>

            <div style={{ ...card, marginTop: 14 }}>
              <div style={{ opacity: 0.75, fontSize: 12 }}>Unclaimed rewards</div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginTop: 6 }}>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 950 }}>{fmt(showUnclaimed, 4)} BOOP</div>

                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                    Next claim in: {secondsToHMS(nextClaimSec)}
                  </div>

                  <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>
                    NFT: {hasNft ? (nftEligible ? "Active ✅" : "Holding (needs ≥ 3.5M)") : "None"}
                    {"  •  "}
                    SuperBoost: {boostEligibleSuper ? "Eligible ✅" : "Needs ≥ 3.0M"}
                  </div>
                </div>

                <div style={{ minWidth: 140, textAlign: "right" }}>
                  <button onClick={onClaim} disabled={!canClaim || claimBusy} style={!canClaim || claimBusy ? btnDisabled : btn}>
                    {claimBusy ? "Claiming…" : "Claim"}
                  </button>

                  <div style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>Fee applies on claim (2%)</div>
                </div>
              </div>

              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 10 }}>
                Daily claim gives +25 XP. Miss a day → streak resets to 0.
              </div>
            </div>

            {loading ? <div style={{ marginTop: 10, opacity: 0.6, fontSize: 12 }}>Loading…</div> : null}

            {err ? (
              <div
                style={{
                  marginTop: 10,
                  borderRadius: 12,
                  padding: 10,
                  border: "1px solid rgba(255,107,107,0.35)",
                  background: "rgba(255,107,107,0.08)",
                  fontSize: 12,
                }}
              >
                {err}
              </div>
            ) : null}

            {msg ? (
              <div
                style={{
                  marginTop: 10,
                  borderRadius: 12,
                  padding: 10,
                  border: "1px solid rgba(113,255,170,0.25)",
                  background: "rgba(113,255,170,0.06)",
                  fontSize: 12,
                }}
              >
                {msg}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
