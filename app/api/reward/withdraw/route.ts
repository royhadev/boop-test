import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: Request) {
  try {
    const { fid } = await req.json()

    if (!fid) {
      return NextResponse.json({ error: 'Missing fid' }, { status: 400 })
    }

    // 1) کاربر بر اساس fid
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('*')
      .eq('fid', fid)
      .single()

    if (userErr || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 2) همه استیک‌هایی که unclaimed_reward > 0 دارند
    const { data: stakes, error: stakeErr } = await supabase
      .from('stakes')
      .select('id, unclaimed_reward')
      .eq('user_id', user.id)
      .gt('unclaimed_reward', 0)

    if (stakeErr) {
      console.error('Stake fetch error:', stakeErr)
      return NextResponse.json({ error: 'Stake fetch error' }, { status: 500 })
    }

    const stakeList = stakes || []
    let totalReward = 0

    for (const s of stakeList as any[]) {
      totalReward += Number(s.unclaimed_reward ?? 0)
    }

    if (totalReward <= 0) {
      return NextResponse.json({ error: 'No rewards to withdraw' }, { status: 400 })
    }

    // 3) محاسبه Fee ۲٪
    const feePercent = 2
    const feeAmount = (totalReward * feePercent) / 100
    const netReward = totalReward - feeAmount

    // 4) صفر کردن unclaimed_reward برای همه استیک‌های این یوزر
    const { error: updateErr } = await supabase
      .from('stakes')
      .update({ unclaimed_reward: 0 })
      .eq('user_id', user.id)
      .gt('unclaimed_reward', 0)

    if (updateErr) {
      console.error('Reward withdraw update error:', updateErr)
      return NextResponse.json({ error: 'Failed to update rewards' }, { status: 500 })
    }

    // TODO:
    //  - feeAmount را بین Burn / Treasury / Team تقسیم کن و در جدول جدا لاگ کن
    //  - روی زنجیره توکن را بفرست به کیف پول کاربر

    return NextResponse.json({
      success: true,
      withdrawnReward: netReward,   // مبلغ خالص برای کاربر
      grossReward: totalReward,     // مبلغ قبل از fee
      feePercent,
      feeAmount,
    })
  } catch (err) {
    console.error('Reward withdraw error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
