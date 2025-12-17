// app/api/reward/claim/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calcApr, calcRewardDelta, type BoostKind } from "@/lib/rewardEngine";

function toMs(v: any): number | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const fid = Number(body?.fid || 0);

    if (!fid || !Number.isFinite(fid)) {
      return NextResponse.json({ error: "Missing fid" }, { status: 400 });
    }

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    // user
    const { data: user, error: ue } = await supabaseAdmin
      .from("users")
      .select("id, fid, xp, level, daily_streak, last_daily_claim")
      .eq("fid", fid)
      .single();

    if (ue || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // cooldown 24h
    const lastClaimAt = user.last_daily_claim ? String(user.last_daily_claim) : null;
    const lastClaimMs = lastClaimAt ? toMs(lastClaimAt) : null;
    const COOLDOWN_MS = 24 * 3600 * 1000;

    if (lastClaimMs != null && nowMs < lastClaimMs + COOLDOWN_MS) {
      const nextClaimInSeconds = Math.max(0, Math.floor((lastClaimMs + COOLDOWN_MS - nowMs) / 1000));
      return NextResponse.json(
        { error: "Claim not ready yet", nextClaimInSeconds },
        { status: 400 }
      );
    }

    // stakes
    const { data: stakes, error: se } = await supabaseAdmin
      .from("stakes")
      .select("id, staked_amount, status, last_reward_at, unclaimed_reward")
      .eq("user_id", user.id);

    if (se) {
      return NextResponse.json({ error: "Failed to load stakes" }, { status: 500 });
    }

    const all = Array.isArray(stakes) ? stakes : [];
    const activeStakes = all.filter((s) => String(s.status).toLowerCase() === "active");
    const totalActiveStaked = activeStakes.reduce((a, s) => a + Number(s.staked_amount || 0), 0);

    // nft
    const { data: nftRows } = await supabaseAdmin
      .from("nft_ownership")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);
    const hasNft = !!(nftRows && nftRows.length > 0);

    // boosts (one active max)
    const { data: boostRows } = await supabaseAdmin
      .from("user_boosts")
      .select("kind, starts_at, ends_at")
      .eq("user_id", user.id)
      .lte("starts_at", nowIso)
      .gte("ends_at", nowIso)
      .limit(1);
    const boostKind: BoostKind = boostRows?.[0]?.kind ?? null;

    // compute gross claimable (live)
    let gross = 0;

    for (const s of all) {
      const status = String(s.status || "").toLowerCase();
      // pending: rewards paused (only keep stored unclaimed if any)
      if (status !== "active") {
        gross += Number(s.unclaimed_reward || 0);
        continue;
      }

      const stakeAmt = Number(s.staked_amount || 0);
      const stored = Number(s.unclaimed_reward || 0);
      const lastRewardMs = toMs(s.last_reward_at) ?? nowMs;

      const apr = calcApr({
        stakeAmount: stakeAmt,
        totalActiveStaked,
        level: Number(user.level || 0),
        streakDays: Number(user.daily_streak || 0),
        hasNft,
        boostKind,
      });

      const delta = calcRewardDelta({
        stakeAmount: stakeAmt,
        aprPercent: apr.totalApr,
        fromMs: lastRewardMs,
        toMs: nowMs,
      });

      gross += stored + delta;
    }

    // fee 2%
    const feeRate = 0.02;
    const fee = gross * feeRate;
    const net = Math.max(0, gross - fee);

    // ✅ Update user streak + xp
    // streak rule: if last claim was > 48h ago => reset to 1, else +1
    const STREAK_RESET_MS = 48 * 3600 * 1000;

    const prevStreak = Number(user.daily_streak || 0);
    const newStreak =
      lastClaimMs == null
        ? 1
        : nowMs - lastClaimMs > STREAK_RESET_MS
        ? 1
        : Math.min(9999, prevStreak + 1);

    const newXp = Number(user.xp || 0) + 25;

    const { error: uu } = await supabaseAdmin
      .from("users")
      .update({
        xp: newXp,
        daily_streak: newStreak,
        last_daily_claim: nowIso,
      })
      .eq("id", user.id);

    if (uu) {
      return NextResponse.json({ error: "Failed to update user claim state" }, { status: 500 });
    }

    // ✅ Reset all stakes reward counters NOW (so Unclaimed becomes ~0 immediately)
    // - active: set last_reward_at=now, unclaimed_reward=0
    // - pending: we can also zero unclaimed_reward to avoid UI confusion
    const ids = all.map((x) => x.id).filter(Boolean);
    if (ids.length) {
      const { error: su } = await supabaseAdmin
        .from("stakes")
        .update({
          unclaimed_reward: 0,
          last_reward_at: nowIso,
        })
        .in("id", ids);

      if (su) {
        return NextResponse.json({ error: "Failed to reset stake rewards" }, { status: 500 });
      }
    }

    // optional: log
    try {
      await supabaseAdmin.from("reward_logs").insert({
        user_id: user.id,
        fid,
        gross_amount: gross,
        fee_amount: fee,
        net_amount: net,
        created_at: nowIso,
        meta: { feeRate },
      });
    } catch {
      // ignore
    }

    return NextResponse.json({
      ok: true,
      fid,
      gross,
      fee,
      net,
      xpGained: 25,
      dailyStreak: newStreak,
      lastClaimAt: nowIso,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error in reward/claim" },
      { status: 500 }
    );
  }
}
