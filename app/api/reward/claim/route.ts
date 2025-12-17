// app/api/reward/claim/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calcApr, calcRewardDelta } from "@/lib/rewardEngine";

const DAILY_XP = 25;
const CLAIM_FEE_PCT = 0.02;
const DAY = 24 * 3600 * 1000;

function toMs(v: any): number | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

function toNum(v: any, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

// Level 0..20 based on 5250 XP total
function xpToLevel(xp: number) {
  const XP_L20 = 5250;
  const step = XP_L20 / 20; // 262.5
  const lv = Math.floor(Math.max(0, xp) / step);
  return Math.max(0, Math.min(20, lv));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const fid = Number(body?.fid || 0);
    if (!fid) {
      return NextResponse.json({ ok: false, error: "Missing fid" }, { status: 400 });
    }

    const now = new Date();
    const nowMs = now.getTime();
    const nowIso = now.toISOString();

    // user
    const { data: user, error: uErr } = await supabaseAdmin
      .from("users")
      .select("id, fid, xp, level, daily_streak, last_claimed_at, withdrawable_rewards")
      .eq("fid", fid)
      .single();

    if (uErr || !user) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    // cooldown 24h
    const lastClaimMs = toMs((user as any).last_claimed_at);
    if (lastClaimMs && nowMs < lastClaimMs + DAY) {
      const left = Math.max(0, Math.floor((lastClaimMs + DAY - nowMs) / 1000));
      return NextResponse.json(
        { ok: false, error: "Too early to claim", nextClaimInSeconds: left },
        { status: 400 }
      );
    }

    // stakes
    const { data: stakes, error: sErr } = await supabaseAdmin
      .from("stakes")
      .select("id, staked_amount, status, started_at, last_reward_at, unclaimed_reward")
      .eq("user_id", (user as any).id);

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
      .eq("user_id", (user as any).id)
      .eq("active", true)
      .limit(1);

    const hasNft = Array.isArray(nftRows) && nftRows.length > 0;

    // boost (minimal)
    const { data: boostRows } = await supabaseAdmin
      .from("user_boosts")
      .select("id")
      .eq("user_id", (user as any).id)
      .eq("active", true)
      .limit(1);

    const boostActive = Array.isArray(boostRows) && boostRows.length > 0;

    // APR based on total active staked
    const apr = calcApr({
      totalStaked,
      hasNft,
      boostActive,
      level: toNum((user as any).level, 0),
      dailyStreak: toNum((user as any).daily_streak, 0),
    });

    // compute gross:
    // - for active: stored + delta
    // - for non-active: ONLY stored
    let gross = 0;

    for (const st of all) {
      const status = String((st as any).status || "").toLowerCase();
      const stored = toNum((st as any).unclaimed_reward, 0);

      if (status !== "active") {
        gross += stored;
        continue;
      }

      const stakedAmount = toNum((st as any).staked_amount, 0);
      const fromMs = toMs((st as any).last_reward_at ?? (st as any).started_at) ?? nowMs;

      const delta = calcRewardDelta({
        stakedAmount,
        aprPercent: (apr as any).totalApr,
        fromMs,
        toMs: nowMs,
      });

      gross += stored + delta;
    }

    gross = Math.max(0, gross);

    const fee = gross * CLAIM_FEE_PCT;
    const net = Math.max(0, gross - fee);

    // --- streak update ---
    const oldStreak = toNum((user as any).daily_streak, 0);
    let newStreak = 1;

    if (!lastClaimMs) {
      newStreak = 1;
    } else {
      const diff = nowMs - lastClaimMs;
      newStreak = diff <= 2 * DAY ? oldStreak + 1 : 1;
    }

    // --- xp + level ---
    const oldXp = toNum((user as any).xp, 0);
    const newXp = oldXp + DAILY_XP;

    const computedLevel = xpToLevel(newXp);
    const oldLevel = toNum((user as any).level, 0);
    const newLevel = Math.max(oldLevel, computedLevel);

    // --- reset ALL stake stored rewards to 0 ---
    if (all.length > 0) {
      const { error: upStErr } = await supabaseAdmin
        .from("stakes")
        .update({
          unclaimed_reward: 0,
          last_reward_at: nowIso,
        })
        .eq("user_id", (user as any).id);

      if (upStErr) {
        return NextResponse.json({ ok: false, error: upStErr.message }, { status: 500 });
      }
    }

    // --- update user withdrawable + streak/xp/level + last_claimed_at ---
    const newWithdrawable = toNum((user as any).withdrawable_rewards, 0) + net;

    const { error: upUErr } = await supabaseAdmin
      .from("users")
      .update({
        last_claimed_at: nowIso,
        // legacy sync (do not remove)
        last_daily_claim: nowIso,
        daily_streak: newStreak,
        xp: newXp,
        level: newLevel,
        withdrawable_rewards: newWithdrawable,
      })
      .eq("fid", fid);

    if (upUErr) {
      return NextResponse.json({ ok: false, error: upUErr.message }, { status: 500 });
    }

    // ✅ NEW: write monthly XP log (so monthly leaderboard works)
    // فقط ستون‌های مطمئن: user_id, amount, created_at
    try {
      const { error: xpErr } = await supabaseAdmin.from("xp_logs").insert({
        user_id: (user as any).id,
        amount: DAILY_XP,
        created_at: nowIso,
      });
      // اگر اسکیمای xp_logs فرق داشت، claim رو fail نکنیم
      if (xpErr) {
        // eslint-disable-next-line no-console
        console.warn("xp_logs insert failed:", xpErr.message);
      }
    } catch {
      // ignore
    }

    return NextResponse.json({
      ok: true,
      fid,
      gross,
      fee,
      net,
      withdrawable_rewards: newWithdrawable,
      dailyStreak: newStreak,
      xp: newXp,
      level: newLevel,
      lastClaimAt: nowIso,
      nextClaimInSeconds: 24 * 60 * 60,
      apr,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Claim failed" }, { status: 500 });
  }
}
