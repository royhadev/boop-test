import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

// Helper برای محاسبه APR_base طبق فرمولی که با هم توافق کردیم
function computeBaseApr(stakedAmount: number): number {
  if (!stakedAmount || stakedAmount <= 0 || !Number.isFinite(stakedAmount)) {
    return 15 // حداقل APR
  }

  // APR_base_raw = 10 + 8 × log10(staked_amount)
  const log10 = Math.log10(stakedAmount)
  let aprRaw = 10 + 8 * log10

  // clamp بین 15% و 60%
  if (!Number.isFinite(aprRaw)) {
    aprRaw = 15
  }

  const apr = Math.min(60, Math.max(15, aprRaw))
  return apr
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { fid, amount } = body as { fid?: number; amount?: number }

    if (!fid) {
      return NextResponse.json(
        { error: 'Missing fid' },
        { status: 400 }
      )
    }

    const stakeAmount = Number(amount)
    if (!stakeAmount || stakeAmount <= 0 || !Number.isFinite(stakeAmount)) {
      return NextResponse.json(
        { error: 'Invalid stake amount' },
        { status: 400 }
      )
    }

    // 1) پیدا کردن user بر اساس fid
    const { data: user, error: userError } = await supabase
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

    // 2) محاسبه APR_base بر اساس مقدار stake
    const aprBase = computeBaseApr(stakeAmount)

    // 3) فقط زمان شروع استیک؛ هنوز هیچ درخواست Unstakeای ثبت نشده
    const now = new Date()
    const startedAt = now.toISOString()

    // 4) ساخت رکورد stake جدید
    const { data: newStake, error: stakeError } = await supabase
      .from('stakes')
      .insert({
        user_id: user.id,
        staked_amount: stakeAmount,
        apr_base: aprBase,
        started_at: startedAt,
        // تا زمانی که کاربر Unstake نکند، این مقدار خالی (null) می‌ماند
        unlock_at: null,
        status: 'active',
        unclaimed_reward: 0,
      })
      .select('id, staked_amount, apr_base, unlock_at, status, unclaimed_reward')
      .single()

    if (stakeError || !newStake) {
      console.error(stakeError)
      return NextResponse.json(
        { error: 'Failed to create stake' },
        { status: 500 }
      )
    }

    // می‌تونی بعداً اینجا لاگ یا event هم اضافه کنی
    return NextResponse.json(
      {
        message: 'Stake created successfully',
        stake: newStake,
      },
      { status: 200 }
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: 'Unexpected error while creating stake' },
      { status: 500 }
    )
  }
}
