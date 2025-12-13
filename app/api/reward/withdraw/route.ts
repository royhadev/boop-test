import { NextResponse } from "next/server"
import { supabaseAdmin } from "../../../../lib/supabaseAdmin"

const WITHDRAW_FEE_PERCENT = 2 // 2%

export async function POST(req: Request) {
  try {
    const { fid } = await req.json()

    if (!fid) {
      return NextResponse.json({ error: "fid is required" }, { status: 400 })
    }

    // 1) گرفتن user
    const { data: userRows, error: userErr } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("fid", fid)
      .limit(1)

    if (userErr) {
      console.error("reward/withdraw: user query error", userErr)
      return NextResponse.json({ error: "Failed to load user" }, { status: 500 })
    }

    if (!userRows || userRows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const user = userRows[0]

    // 2) گرفتن همه‌ی پوزیشن‌های کاربر
    const { data: stakesRows, error: stakesErr } = await supabaseAdmin
      .from("stakes")
      .select("id, staked_amount, unclaimed_reward, status")
      .eq("user_id", user.id)
      .neq("status", "withdrawn")

    if (stakesErr) {
      console.error("reward/withdraw: stakes query error", stakesErr)
      return NextResponse.json({ error: "Failed to load stakes" }, { status: 500 })
    }

    const stakes = stakesRows || []

    if (stakes.length === 0) {
      return NextResponse.json(
        { error: "No active stakes found for user" },
        { status: 400 }
      )
    }

    // 3) مجموع unclaimed_reward
    const totalReward = stakes.reduce(
      (sum: number, s: any) => sum + (s.unclaimed_reward || 0),
      0
    )

    if (totalReward <= 0) {
      return NextResponse.json(
        { error: "No rewards to withdraw" },
        { status: 400 }
      )
    }

    const feePercent = WITHDRAW_FEE_PERCENT
    const feeAmount = (totalReward * feePercent) / 100
    const netReward = totalReward - feeAmount

    const nowIso = new Date().toISOString()

    // 4) صفر کردن unclaimed_reward تمام پوزیشن‌ها
    const { error: updateErr } = await supabaseAdmin
      .from("stakes")
      .update({
        unclaimed_reward: 0,
        last_reward_at: nowIso,
      })
      .eq("user_id", user.id)
      .neq("status", "withdrawn")

    if (updateErr) {
      console.error("reward/withdraw: update stakes error", updateErr)
      return NextResponse.json(
        { error: "Failed to reset rewards after withdraw" },
        { status: 500 }
      )
    }

    // TODO: نسخه on-chain:
    // netReward را به کیف پول کاربر بفرستیم

    return NextResponse.json({
      success: true,
      withdrawnReward: netReward,
      grossReward: totalReward,
      feePercent,
      feeAmount,
    })
  } catch (e) {
    console.error("reward/withdraw: unexpected error", e)
    return NextResponse.json(
      { error: "Internal server error", details: String((e as any)?.message || e) },
      { status: 500 }
    )
  }
}
