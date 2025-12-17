// app/api/reward/status/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calcApr, calcRewardDelta } from "@/lib/rewardEngine";

function toMs(v: any): number | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

function toNum(v: any, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function bestEndsAt(row: any): number | null {
  return (
    toMs(row?.ends_at) ??
    toMs(row?.expires_at) ??
    toMs(row?.active_until) ??
    toMs(row?.endsAt) ??
    toMs(row?.expiresAt) ??
    toMs(row?.activeUntil) ??
    null
  );
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const fid = Number(url.searchParams.get("fid") || 0);
    if (!fid || !Number.isFinite(fid)) {
      return NextResponse.json({ ok: false, error: "Missing fid" }, { status: 400 });
    }

    const nowMs = Date.now();

    // user (✅ canonical column: last_claimed_at)
    const { data: user, error: uErr } = await supabaseAdmin
      .from("users")
      .select("id, fid, xp, level, daily_streak, last_claimed_at, withdrawable_rewards")
      .eq("fid", fid)
      .single();

    if (uErr || !user) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    // stakes
    const { data: stakes, error: sErr } = await supabaseAdmin
      .from("stakes")
      .select("id, staked_amount, status, started_at, last_reward_at, unclaimed_reward")
      .eq("user_id", user.id);

    if (sErr) {
      return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
    }

    const all = Array.isArray(stakes) ? stakes : [];
    const activeStakes = all.filter((x) => String((x as any).status || "").toLowerCase() === "active");
    const totalStaked = activeStakes.reduce((a, b) => a + toNum((b as any).staked_amount, 0), 0);

    // nft
    const { data: nftRows } = await supabaseAdmin
      .from("nft_ownership")
      .select("id")
      .eq("user_id", user.id)
      .eq("active", true)
      .limit(1);

    const hasNft = Array.isArray(nftRows) && nftRows.length > 0;

    // boost (robust)
    const { data: boostRows } = await supabaseAdmin
      .from("user_boosts")
      .select("*")
      .eq("user_id", user.id)
      .limit(10);

    const boosts = Array.isArray(boostRows) ? boostRows : [];

    let boostActive = false;
    let boostEndsAtMs: number | null = null;

    for (const r of boosts) {
      const activeFlag = r?.active === true || r?.is_active === true;
      const endsAt = bestEndsAt(r);
      const unexpired = endsAt ? nowMs < endsAt : false;

      if (activeFlag || unexpired) {
        boostActive = true;
        if (endsAt && (!boostEndsAtMs || endsAt > boostEndsAtMs)) {
          boostEndsAtMs = endsAt;
        }
      }
    }

    const boostEndsAt = boostEndsAtMs ? new Date(boostEndsAtMs).toISOString() : null;

    // APR
    const apr = calcApr({
      totalStaked,
      hasNft,
      boostActive,
      level: toNum((user as any).level, 0),
      dailyStreak: toNum((user as any).daily_streak, 0),
    });

    // live total unclaimed
    let totalUnclaimed = 0;

    for (const st of all) {
      const status = String((st as any).status || "").toLowerCase();

      if (status !== "active") {
        totalUnclaimed += toNum((st as any).unclaimed_reward, 0);
        continue;
      }

      const stakedAmount = toNum((st as any).staked_amount, 0);
      const stored = toNum((st as any).unclaimed_reward, 0);
      const fromMs = toMs((st as any).last_reward_at ?? (st as any).started_at) ?? nowMs;

      const delta = calcRewardDelta({
        stakedAmount,
        aprPercent: apr.totalApr,
        fromMs,
        toMs: nowMs,
      });

      totalUnclaimed += stored + delta;
    }

    // cooldown (24h)
    const lastClaimMs = toMs((user as any).last_claimed_at);
    const COOLDOWN_MS = 24 * 60 * 60 * 1000;

    const nextClaimAtMs = lastClaimMs ? lastClaimMs + COOLDOWN_MS : 0;
    const nextClaimInSeconds = lastClaimMs
      ? Math.max(0, Math.floor((nextClaimAtMs - nowMs) / 1000))
      : 0;

    const canClaim = !lastClaimMs || nowMs >= nextClaimAtMs;

    return NextResponse.json({
      ok: true,
      fid,
      totalUnclaimed: Math.max(0, totalUnclaimed),
      canClaim,
      nextClaimInSeconds,
      // ✅ دقیقاً از canonical ستون
      lastClaimAt: (user as any).last_claimed_at ? String((user as any).last_claimed_at) : null,
      dailyStreak: toNum((user as any).daily_streak, 0),
      withdrawable: toNum((user as any).withdrawable_rewards, 0),
      totalStaked,
      feePercent: 2,
      nftActive: hasNft,
      boostActive,
      boostEndsAt,
      apr,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "reward status failed" },
      { status: 500 }
    );
  }
}
