// app/api/stake/unstake/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { calcApr, calcRewardDelta } from "@/lib/rewardEngine";

const UNLOCK_DAYS = 21;

function toMs(v: any): number | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

function toNum(v: any, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export async function POST(req: Request) {
  try {
    const { fid, stakeId } = await req.json();

    if (!fid || !stakeId) {
      return NextResponse.json({ error: "Missing fid or stakeId" }, { status: 400 });
    }

    // 1) user
    const { data: user, error: userErr } = await supabaseAdmin
      .from("users")
      .select("id, fid, level, daily_streak")
      .eq("fid", fid)
      .single();

    if (userErr || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 2) stake target
    const { data: stake, error: stakeErr } = await supabaseAdmin
      .from("stakes")
      .select("id, user_id, status, staked_amount, started_at, last_reward_at, unclaimed_reward")
      .eq("id", stakeId)
      .eq("user_id", user.id)
      .single();

    if (stakeErr || !stake) {
      return NextResponse.json({ error: "Stake not found" }, { status: 404 });
    }

    if (String(stake.status || "").toLowerCase() !== "active") {
      return NextResponse.json({ error: "Stake is not active" }, { status: 400 });
    }

    // 3) gather context for APR (based on current active stakes BEFORE unstake)
    const { data: stakesAll, error: sErr } = await supabaseAdmin
      .from("stakes")
      .select("id, staked_amount, status")
      .eq("user_id", user.id);

    if (sErr) {
      return NextResponse.json({ error: sErr.message }, { status: 500 });
    }

    const all = Array.isArray(stakesAll) ? stakesAll : [];
    const activeStakes = all.filter((x) => String(x.status || "").toLowerCase() === "active");
    const totalStakedBefore = activeStakes.reduce((a, b) => a + toNum(b.staked_amount, 0), 0);

    // nft
    const { data: nftRows } = await supabaseAdmin
      .from("nft_ownership")
      .select("id")
      .eq("user_id", user.id)
      .eq("active", true)
      .limit(1);

    const hasNft = Array.isArray(nftRows) && nftRows.length > 0;

    // boost
    const { data: boostRows } = await supabaseAdmin
      .from("user_boosts")
      .select("id")
      .eq("user_id", user.id)
      .eq("active", true)
      .limit(1);

    const boostActive = Array.isArray(boostRows) && boostRows.length > 0;

    const apr = calcApr({
      totalStaked: totalStakedBefore,
      hasNft,
      boostActive,
      level: toNum(user.level, 0),
      dailyStreak: toNum(user.daily_streak, 0),
    });

    // 4) SNAPSHOT reward for this stake right now (stored + delta)
    const now = new Date();
    const nowIso = now.toISOString();
    const nowMs = now.getTime();

    const stored = toNum(stake.unclaimed_reward, 0);
    const fromMs = toMs(stake.last_reward_at ?? stake.started_at) ?? nowMs;

    const delta = calcRewardDelta({
      stakedAmount: toNum(stake.staked_amount, 0),
      aprPercent: apr.totalApr,
      fromMs,
      toMs: nowMs,
    });

    const snap = Math.max(0, stored + delta);

    // 5) set unlock_at
    const unlockAt = new Date(nowMs + UNLOCK_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // 6) update stake: pending + snapshot saved
    const { error: updateErr } = await supabaseAdmin
      .from("stakes")
      .update({
        status: "pending_unstake",
        unlock_at: unlockAt,
        unclaimed_reward: snap,
        last_reward_at: nowIso, // مهم: برای اینکه بعداً دوباره delta اشتباهی نشه
      })
      .eq("id", stakeId);

    if (updateErr) {
      console.error("Stake unstake update error:", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Unstake started. Tokens will be unlockable after ${UNLOCK_DAYS} days.`,
      unlock_at: unlockAt,
      snap_unclaimed_saved: snap,
      apr_used: apr.totalApr,
    });
  } catch (err) {
    console.error("Stake unstake error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
