import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

// 🔹 تنظیمات Fee برای برداشت استیک
// 1% کل استیک، که نصف می‌سوزد و نصف به والت تیم می‌رود
const WITHDRAW_FEE_RATE = 0.01 // 1%
const BURN_SHARE = 0.5         // 50% از Fee → Burn
const TEAM_SHARE = 0.5         // 50% از Fee → Team (هزینه‌های جاری)

export async function POST(req: Request) {
  try {
    const { fid, stakeId } = await req.json()

    if (!fid || !stakeId) {
      return NextResponse.json(
        { error: 'Missing fid or stakeId' },
        { status: 400 }
      )
    }

    // 1) پیدا کردن یوزر بر اساس fid
    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('id, fid')
      .eq('fid', fid)
      .single()

    if (userErr || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 2) پیدا کردن استیک مربوط به این یوزر
    const { data: stake, error: stakeErr } = await supabaseAdmin
      .from('stakes')
      .select('*')
      .eq('id', stakeId)
      .eq('user_id', user.id)
      .single()

    if (stakeErr || !stake) {
      return NextResponse.json({ error: 'Stake not found' }, { status: 404 })
    }

    // اگر قبلاً withdraw شده
    if (stake.status === 'withdrawn') {
      return NextResponse.json(
        { error: 'Stake already withdrawn' },
        { status: 400 }
      )
    }

    // فقط از دو حالت اجازه Withdraw داریم:
    //  - pending_unstake (بعد از Unstake)
    //  - unlocked (در آینده اگر مستقیم unlock شده باشد)
    if (stake.status !== 'pending_unstake' && stake.status !== 'unlocked') {
      return NextResponse.json(
        { error: 'Stake is not ready to withdraw' },
        { status: 400 }
      )
    }

    // باید unlock_at تنظیم شده باشد
    if (!stake.unlock_at) {
      return NextResponse.json(
        { error: 'Unlock time is not set' },
        { status: 400 }
      )
    }

    const now = new Date()
    const unlockAt = new Date(stake.unlock_at)

    // اگر هنوز ۲۱ روز (یا دوره) تمام نشده باشد
    if (unlockAt.getTime() > now.getTime()) {
      return NextResponse.json(
        {
          error: 'Stake is still locked',
          unlock_at: stake.unlock_at,
        },
        { status: 400 }
      )
    }

    // 3) محاسبه فی ۱٪ و سهم Burn / Team
    const originalAmount = Number(stake.staked_amount ?? 0)

    if (!originalAmount || !Number.isFinite(originalAmount) || originalAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid staked amount for withdraw' },
        { status: 400 }
      )
    }

    const totalFee = originalAmount * WITHDRAW_FEE_RATE // 1% از استیک
    const burnAmount = totalFee * BURN_SHARE            // 0.5% از استیک
    const teamAmount = totalFee * TEAM_SHARE            // 0.5% از استیک
    const userReceive = originalAmount - totalFee       // مقدار خالصی که به کاربر می‌رسد

    // 4) آپدیت استیک: دیگر فعال نیست و مقدار روی صفر
    const { error: updateErr } = await supabaseAdmin
      .from('stakes')
      .update({
        status: 'withdrawn',
        staked_amount: 0,
        unclaimed_reward: 0,
      })
      .eq('id', stakeId)

    if (updateErr) {
      console.error('Stake withdraw update error:', updateErr)
      return NextResponse.json(
        { error: 'Failed to update stake as withdrawn' },
        { status: 500 }
      )
    }

    // 5) لاگ سبک در api_logs (برای مانیتور)
    try {
      await supabaseAdmin.from('api_logs').insert({
        user_id: user.id,
        endpoint: '/api/stake/withdraw',
      })
    } catch (logErr) {
      console.warn('Failed to log /api/stake/withdraw:', logErr)
    }

    // (در آینده اگر جدول خزانه و Burn/Treasury/Team اضافه کردیم،
    // همین‌جا می‌تونیم:
    // - burnAmount رو به آدرس Burn بفرستیم
    // - teamAmount رو به والت Team Ops لاگ کنیم / آنچین کنیم)

    return NextResponse.json({
      success: true,
      stakeId,
      amounts: {
        original_stake: originalAmount,
        fee_total: totalFee,
        user_receive: userReceive,
        burn_boops: burnAmount,
        team_boops: teamAmount,
      },
      meta: {
        fee_rate: WITHDRAW_FEE_RATE,
        burn_share: BURN_SHARE,
        team_share: TEAM_SHARE,
      },
    })
  } catch (err) {
    console.error('Stake withdraw error:', err)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}
