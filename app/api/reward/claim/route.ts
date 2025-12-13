import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

const MIN_CLAIM_INTERVAL_HOURS = 22  // حداقل فاصله‌ی بین دو Claim
const STREAK_RESET_HOURS = 48        // اگر بیشتر از این فاصله بشه، استریک می‌سوزه

// مقدار XP برای هر Claim روزانه
const BASE_XP_PER_CLAIM = 25
const STREAK_XP_PER_DAY = 5
const MAX_STREAK_BONUS_XP = 100

function hoursDiff(a: Date, b: Date) {
  return (a.getTime() - b.getTime()) / (1000 * 60 * 60)
}

// تبدیل XP به Level (اگر خواستی بعداً راحت می‌تونی عددها رو عوض کنی)
function levelFromXp(xp: number): number {
  if (xp >= 3000) return 5
  if (xp >= 1800) return 4
  if (xp >= 900) return 3
  if (xp >= 300) return 2
  return 1
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const fid = typeof body.fid === 'number' ? body.fid : Number(body.fid)

    if (!fid || Number.isNaN(fid)) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid fid' },
        { status: 400 }
      )
    }

    // فقط جدول users – اصلاً به stakes دست نمی‌زنیم
    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('fid', fid)
      .single()

    if (userErr || !user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const now = new Date()
    const lastClaim = user.last_daily_claim
      ? new Date(user.last_daily_claim)
      : null

    let hoursSinceLast: number | null = null
    if (lastClaim) {
      hoursSinceLast = hoursDiff(now, lastClaim)
    }

    // اگر هنوز ۲۲ ساعت نشده، اجازه‌ی Claim نمی‌دهیم
    if (hoursSinceLast !== null && hoursSinceLast < MIN_CLAIM_INTERVAL_HOURS) {
      const nextClaimAt = new Date(
        lastClaim!.getTime() + MIN_CLAIM_INTERVAL_HOURS * 60 * 60 * 1000
      ).toISOString()

      return NextResponse.json(
        {
          success: false,
          error: 'Daily reward already claimed recently',
          next_claim_at: nextClaimAt,
        },
        { status: 400 }
      )
    }

    // محاسبه‌ی استریک جدید
    let newStreak = user.daily_streak ?? 0
    if (!lastClaim || hoursSinceLast! > STREAK_RESET_HOURS) {
      // استریک سوخته → دوباره از ۱ شروع می‌کنیم
      newStreak = 1
    } else {
      newStreak = newStreak + 1
    }

    // XP امروز
    const streakBonusXp = Math.min(
      newStreak * STREAK_XP_PER_DAY,
      MAX_STREAK_BONUS_XP
    )

    const gainedXp = BASE_XP_PER_CLAIM + streakBonusXp
    const newXp = (user.xp ?? 0) + gainedXp
    const newLevel = levelFromXp(newXp)

    const { error: updateErr } = await supabaseAdmin
      .from('users')
      .update({
        xp: newXp,
        level: newLevel,
        daily_streak: newStreak,
        last_daily_claim: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', user.id)

    if (updateErr) {
      console.error('Failed to update user on claim:', updateErr)
      return NextResponse.json(
        { success: false, error: 'Failed to update user' },
        { status: 500 }
      )
    }

    const nextClaimAt = new Date(
      now.getTime() + MIN_CLAIM_INTERVAL_HOURS * 60 * 60 * 1000
    ).toISOString()

    return NextResponse.json({
      success: true,
      fid,
      gained_xp: gainedXp,
      new_xp: newXp,
      new_level: newLevel,
      new_streak: newStreak,
      next_claim_at: nextClaimAt,
    })
  } catch (e: any) {
    console.error('Reward claim error:', e)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
