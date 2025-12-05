import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// ---------------- Supabase client ----------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

// ---------------- Types ----------------

type UserRow = {
  id: string
  fid: number
  username: string | null
  xp: number
  level: number
  daily_streak: number
  last_daily_claim: string | null
}

type StakeRow = {
  id: string
  user_id: string
  staked_amount: number
  apr_base: number | null
  started_at: string
  unlock_at: string | null
  status: 'active' | 'pending_unstake' | 'unlocking' | 'unlocked' | 'withdrawn' | null
  last_reward_at: string | null
  unclaimed_reward: number | null
}

// ---------------- Helpers ----------------

// همان تابع APR پایه که در status استفاده کردیم
function calcAprBase(totalStakedActive: number): number {
  const normalized = totalStakedActive / 10_000_000

  if (normalized <= 0) return 0
  if (normalized < 0.1) return 15
  if (normalized < 0.25) return 18
  if (normalized < 0.5) return 20
  if (normalized < 1) return 22
  if (normalized < 2) return 25
  if (normalized < 5) return 30
  if (normalized < 10) return 35
  return 40
}

// XP → Level با سقف ۱۵ (تا دیگه ۱۱۱ نشه)
function xpToLevel(xp: number): number {
  if (!xp || xp <= 0) return 1

  // منحنی ساده: هر ~۷۵۰ XP یک لول، ولی حداکثر ۱۵
  const base = 1 + Math.floor(xp / 750)
  const level = Math.max(1, Math.min(base, 15))
  return level
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

function dayUTC(d: Date) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

// محاسبه Level-bonus مطابق چیزی که الان در UI می‌بینی:
// Level 1 → 0%
// Level 2–5 → 0.5%
// Level 6–10 → 1.0%
// Level 11–15 → 1.5%
function calcLevelBonus(level: number): number {
  if (level >= 11) return 1.5
  if (level >= 6) return 1.0
  if (level >= 2) return 0.5
  return 0
}

// bonus استریک: تا سقف ۲۰٪ (در status هم باید همین باشد)
function calcStreakBonus(streak: number): number {
  if (streak <= 0) return 0

  // ۷ روز → حدوداً ۸–۹٪ ، ۲۰ روز به بعد تا سقف ۲۰٪
  const capped = Math.min(streak, 20)
  return +( (capped / 20) * 20 ).toFixed(1) // ۰ تا ۲۰ با دقت یک رقم اعشار
}

// ---------------- Handler ----------------

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const fid = Number(body?.fid || 0)

    if (!fid) {
      return NextResponse.json({ error: 'Missing fid' }, { status: 400 })
    }

    // 1) پیدا / ساخت کاربر
    const { data: existingUser, error: existingUserError } = await supabase
      .from('users')
      .select('*')
      .eq('fid', fid)
      .single<UserRow>()

    let user: UserRow

    if (!existingUser || existingUserError) {
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          fid,
          username: `user_${fid}`,
          xp: 0,
          level: 1,
          daily_streak: 0,
          last_daily_claim: null,
        })
        .select('*')
        .single<UserRow>()

      if (insertError || !newUser) {
        console.error('Failed to init user:', insertError)
        return NextResponse.json({ error: 'Failed to init user' }, { status: 500 })
      }

      user = newUser
    } else {
      user = existingUser
    }

    // 2) جلوگیری از بیش از یک Claim در یک روز (بر اساس last_daily_claim)
    if (user.last_daily_claim) {
      const last = new Date(user.last_daily_claim)
      const now = new Date()

      const lastDay = dayUTC(last)
      const nowDay = dayUTC(now)
      const diffDays = Math.floor((nowDay - lastDay) / ONE_DAY_MS)

      if (diffDays <= 0) {
        // امروز قبلاً Claim کرده
        return NextResponse.json(
          { error: 'Already claimed today' },
          { status: 400 },
        )
      }
    }

    // 3) استیک‌های فعال را بخوانیم
    const { data: stakesRaw, error: stakesError } = await supabase
      .from('stakes')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (stakesError) {
      console.error('Failed to load stakes:', stakesError)
      return NextResponse.json({ error: 'Failed to load stakes' }, { status: 500 })
    }

    const stakes = (stakesRaw || []) as StakeRow[]
    const totalStakedActive = stakes.reduce(
      (sum, s) => sum + (s.staked_amount || 0),
      0,
    )

    // اگر استیک فعال ندارد، پاداش = ۰ (ولی می‌تواند XP/Streak هم نگیرد)
    if (totalStakedActive <= 0) {
      return NextResponse.json(
        { error: 'No active stake for reward' },
        { status: 400 },
      )
    }

    // 4) محاسبه Streak جدید
    let newStreak = user.daily_streak || 0
    const now = new Date()

    if (!user.last_daily_claim) {
      // اولین Claim
      newStreak = 1
    } else {
      const last = new Date(user.last_daily_claim)
      const lastDay = dayUTC(last)
      const nowDay = dayUTC(now)
      const diffDays = Math.floor((nowDay - lastDay) / ONE_DAY_MS)

      if (diffDays === 1) {
        // دقیقا دیروز Claim کرده → ادامه‌ی streak
        newStreak = (user.daily_streak || 0) + 1
      } else if (diffDays > 1) {
        // چند روز از دست داده → استریک از نو
        newStreak = 1
      } else if (diffDays <= 0) {
        // نباید به اینجا برسیم چون بالا diffDays<=0 را رد کردیم
        newStreak = user.daily_streak || 1
      }
    }

    // 5) XP جدید + Level جدید (با سقف ۱۵)
    const xpGainPerClaim = 25 // هر Claim چند XP بدهیم
    const newXp = (user.xp || 0) + xpGainPerClaim
    const newLevel = xpToLevel(newXp)

    // 6) محاسبه APR و پاداش امروز (دلخواه: از همین منطق status استفاده می‌کنیم)
    const baseApr = calcAprBase(totalStakedActive)
    const streakBonus = calcStreakBonus(newStreak) // بعد از آپدیت streak
    const levelBonus = calcLevelBonus(newLevel)

    const aprTotal = baseApr + streakBonus + levelBonus
    const dailyReward = (totalStakedActive * (aprTotal / 100)) / 365

    // 7) آپدیت کاربر
    const { error: updateUserError } = await supabase
      .from('users')
      .update({
        xp: newXp,
        level: newLevel,
        daily_streak: newStreak,
        last_daily_claim: now.toISOString(),
      })
      .eq('id', user.id)

    if (updateUserError) {
      console.error('Failed to update user in claim:', updateUserError)
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
    }

    // اینجا فعلاً فقط مقدار dailyReward را برمی‌گردانیم.
    // در آینده می‌توانیم آن را به جدول پاداش‌ها اضافه کنیم.
    return NextResponse.json({
      success: true,
      reward: dailyReward,
      apr: {
        base: baseApr,
        streak: streakBonus,
        level: levelBonus,
        total: aprTotal,
      },
      user: {
        xp: newXp,
        level: newLevel,
        daily_streak: newStreak,
        last_daily_claim: now.toISOString(),
      },
    })
  } catch (err) {
    console.error('API /reward/claim error:', err)
    return NextResponse.json(
      { error: 'Server error while claiming' },
      { status: 500 },
    )
  }
}
