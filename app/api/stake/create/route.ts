import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ✅ MIN stake
const MIN_STAKE_AMOUNT = 1000;

// ✅ Tokenomics decision: Base APR max=60 at 2,500,000
const BASE_APR_MAX = 60;
const BASE_STAKE_CAP = 2_500_000;

function computeBaseApr(stakedAmount: number): number {
  if (!stakedAmount || !Number.isFinite(stakedAmount) || stakedAmount <= 0) return 0;

  const x = Math.max(MIN_STAKE_AMOUNT, Math.min(BASE_STAKE_CAP, stakedAmount));

  // K so that K*log10(2,500,000)=60
  const K = BASE_APR_MAX / Math.log10(BASE_STAKE_CAP);
  const raw = K * Math.log10(x);

  const apr = Math.min(BASE_APR_MAX, Math.max(0, raw));
  return Number(apr.toFixed(2));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fid, amount } = body as { fid?: number; amount?: number };

    if (!fid || !Number.isFinite(Number(fid))) {
      return NextResponse.json({ error: "Missing fid" }, { status: 400 });
    }

    const stakeAmount = Number(amount);
    if (!stakeAmount || !Number.isFinite(stakeAmount) || stakeAmount <= 0) {
      return NextResponse.json({ error: "Invalid stake amount" }, { status: 400 });
    }

    if (stakeAmount < MIN_STAKE_AMOUNT) {
      return NextResponse.json(
        { error: `Minimum stake is ${MIN_STAKE_AMOUNT} BOOP` },
        { status: 400 }
      );
    }

    // 1) find user by fid
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id,fid,username,xp,level,daily_streak,last_daily_claim")
      .eq("fid", fid)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found for this fid" }, { status: 404 });
    }

    // 2) compute apr_base for this stake row
    const aprBase = computeBaseApr(stakeAmount);

    const now = new Date();
    const startedAt = now.toISOString();

    // 3) insert stake
    const { data: newStake, error: stakeError } = await supabaseAdmin
      .from("stakes")
      .insert({
        user_id: user.id,
        staked_amount: stakeAmount,
        apr_base: aprBase,
        started_at: startedAt,
        last_reward_at: startedAt,
        unlock_at: null,
        status: "active",
        unclaimed_reward: 0,
      })
      .select(
        "id, staked_amount, apr_base, started_at, last_reward_at, unlock_at, status, unclaimed_reward"
      )
      .single();

    if (stakeError || !newStake) {
      console.error(stakeError);
      return NextResponse.json({ error: "Failed to create stake" }, { status: 500 });
    }

    // optional log
    try {
      await supabaseAdmin.from("event_logs").insert({
        type: "stake_create",
        fid,
        payload: {
          stake_amount: stakeAmount,
          apr_base: aprBase,
          apr_model: {
            type: "K*log10(stake)",
            max_apr: 60,
            stake_for_max_apr: 2_500_000,
          },
        },
        created_at: startedAt,
      });
    } catch {}

    return NextResponse.json(
      {
        ok: true,
        message: "Stake created successfully",
        stake: newStake,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Stake create error:", err);
    return NextResponse.json({ error: "Unexpected error while creating stake" }, { status: 500 });
  }
}
