import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

// 🔹 حداقل استیک (طبق طراحی سیستم)
const MIN_STAKE_AMOUNT = 1000

// 🔹 Helper برای محاسبه APR_base طبق Tokenomics v2
//
// APR_base = 9 * log10(stake)
// سقف = 60%
// کف = 0%  (چون حداقل استیک ما 1000 هست، عملاً APR از ~27% شروع می‌شود)
function computeBaseApr(stakedAmount: number): number {
  if (!stakedAmount || stakedAmount <= 0 || !Number.isFinite(stakedAmount)) {
    return 0
  }

  const log10 = Math.log10(stakedAmount)
  let aprRaw = 9 * log10

  if (!Number.isFinite(aprRaw)) return 0

  const apr = Math.min(60, Math.max(0, aprRaw))
  return Number(apr.toFixed(2))
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { fid, amount } = body as { fid?: number; amount?: number }

    if (!fid) {
      return NextResponse.json({ error: 'Missing fid' }, { status: 400 })
    }

    const stakeAmount = Number(amount)
    if (!stakeAmount || !Number.isFinite(stakeAmount) || stakeAmount <= 0) {
      return NextResponse.json({ error: 'Invalid stake amount' }, { status: 400 })
    }

    if (stakeAmount < MIN_STAKE_AMOUNT) {
      return NextResponse.json(
        { error: `Minimum stake is ${MIN_STAKE_AMOUNT} BOOP` },
        { status: 400 }
      )
    }

    // 1) پیدا کردن user بر اساس fid
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, fid, username, xp, level, daily_streak, last_daily_claim')
      .eq('fid', fid)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found for this fid' },
        { status: 404 }
      )
    }

    // 2) محاسبه APR_base بر اساس مقدار همین stake (طبق منحنی v2)
    const aprBase = computeBaseApr(stakeAmount)

    const now = new Date()
    const startedAt = now.toISOString()

    // 3) ساخت رکورد stake جدید
    const { data: newStake, error: stakeError } = await supabaseAdmin
      .from('stakes')
      .insert({
        user_id: user.id,
        staked_amount: stakeAmount,
        apr_base: aprBase,
        started_at: startedAt,
        last_reward_at: startedAt, // نقطه شروع محاسبه‌ی پاداش
        unlock_at: null,
        status: 'active',
        unclaimed_reward: 0,
      })
      .select(
        'id, staked_amount, apr_base, started_at, last_reward_at, unlock_at, status, unclaimed_reward'
      )
      .single()

    if (stakeError || !newStake) {
      console.error(stakeError)
      return NextResponse.json(
        { error: 'Failed to create stake' },
        { status: 500 }
      )
    }

    // 4) لاگ سبک برای دیباگ/آمار (اختیاری)
    try {
      await supabaseAdmin.from('event_logs').insert({
        type: 'stake_create',
        fid,
        payload: {
          stake_amount: stakeAmount,
          apr_base: aprBase,
        },
        created_at: startedAt,
      })
    } catch (logErr) {
      console.warn('Failed to log /api/stake/create:', logErr)
    }

    return NextResponse.json(
      {
        message: 'Stake created successfully',
        stake: newStake,
      },
      { status: 200 }
    )
  } catch (err) {
    console.error('Stake create error:', err)
    return NextResponse.json(
      { error: 'Unexpected error while creating stake' },
      { status: 500 }
    )
  }
}
