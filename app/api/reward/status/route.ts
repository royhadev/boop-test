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

// 1) APR پایه بر اساس مقدار استیک فعال (سقف = 60%)
function calcAprBase(totalStakedActive: number): number {
  if (totalStakedActive <= 0) return 0

  if (totalStakedActive < 100_000) return 15
  if (totalStakedActive < 500_000) return 25
  if (totalStakedActive < 1_000_000) return 35
  if (totalStakedActive < 2_000_000) return 45

  // از اینجا به بعد همیشه 60% بمونه، حتی اگر استیک بیشتر بشه
  return 60
}

// 2) محاسبه Level بر اساس XP (فقط از XP می‌آد، نه از DB)
function getLevelFromXp(xp: number): number {
  const levels = [
    { level: 1, minXp: 0 },
    { level: 2, minXp: 100 },
    { level: 3, minXp: 300 },
    { level: 4, minXp: 600 },
    { level: 5, minXp: 1000 },
    { level: 6, minXp: 1500 },
    { level: 7, minXp: 2100 },
    { level: 8, minXp: 2800 },
    { level: 9, minXp: 3600 },
    { level: 10, minXp: 4500 },
    { level: 11, minXp: 5500 },
    { level: 12, minXp: 6600 },
    { level: 13, minXp: 7800 },
    { level: 14, minXp: 9100 },
    { level: 15, minXp: 10500 },
    { level: 16, minXp: 12000 },
    { level: 17, minXp: 13600 },
    { level: 18, minXp: 15300 },
    { level: 19, minXp: 17100 },
    { level: 20, minXp: 19000 },
  ]

  let current = 1
  for (const entry of levels) {
    if (xp >= entry.minXp) current = entry.level
    else break
  }
  return current
}

// 3) Bonus استریک – در 7 روز تا سقف 20%
function calcStreakBonus(dailyStreak: number): number {
  if (!dailyStreak || dailyStreak <= 0) return 0
  const capped = Math.min(dailyStreak, 7)
  const v = (capped * 20) / 7 // روزی ~2.86% تا سقف 20%
  return parseFloat(v.toFixed(1))
}

// 4) Bonus سطح – هر Level بالاتر از 1، 0.5% تا سقف حدود 10%
function calcLevelBonus(level: number): number {
  if (!level || level <= 1) return 0
  const capped = Math.min(level, 20)
  const v = (capped - 1) * 0.5
  return parseFloat(v.toFixed(1))
}

// ---------------- Handler ----------------

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const fid = Number(body?.fid || 0) || 12345

    // 1) پیدا کردن/ساختن کاربر
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

    // ✅ Level واقعی فقط از XP محاسبه می‌شود
    const computedLevel = getLevelFromXp(user.xp || 0)
    const userComputed: UserRow = { ...user, level: computedLevel }

    // 2) خواندن کل پوزیشن‌های استیک (به جز withdrawn)
    const { data: stakesRaw, error: stakesError } = await supabase
      .from('stakes')
      .select('*')
      .eq('user_id', user.id)
      .neq('status', 'withdrawn')

    if (stakesError) {
      console.error('Failed to load stakes:', stakesError)
      return NextResponse.json({ error: 'Failed to load stakes' }, { status: 500 })
    }

    const stakes = (stakesRaw || []) as StakeRow[]

    // 3) دسته‌بندی استیک‌ها بر اساس وضعیت
    const activeStakes = stakes.filter((s) => s.status === 'active')
    const pendingStakes = stakes.filter(
      (s) => s.status === 'pending_unstake' || s.status === 'unlocking',
    )
    const unlockedStakes = stakes.filter((s) => s.status === 'unlocked')

    // 4) مجموع‌ها
    const totalStakedActive = activeStakes.reduce(
      (sum, s) => sum + (s.staked_amount || 0),
      0,
    )

    const totalUnclaimedAll = stakes.reduce(
      (sum, s) => sum + (s.unclaimed_reward || 0),
      0,
    )

    // 5) APR و پاداش روزانه
    const baseApr = calcAprBase(totalStakedActive)
    const streakBonus = calcStreakBonus(userComputed.daily_streak)
    const levelBonus = calcLevelBonus(userComputed.level)

    const aprTotal =
      totalStakedActive > 0 ? baseApr + streakBonus + levelBonus : 0

    const dailyReward =
      totalStakedActive > 0 ? (totalStakedActive * (aprTotal / 100)) / 365 : 0

    // 6) آیا امروز claim شده؟
    let claimedToday = false
    if (userComputed.last_daily_claim) {
      const last = new Date(userComputed.last_daily_claim)
      const now = new Date()
      claimedToday =
        last.getUTCFullYear() === now.getUTCFullYear() &&
        last.getUTCMonth() === now.getUTCMonth() &&
        last.getUTCDate() === now.getUTCDate()
    }

    const activeCount = activeStakes.length
    const pendingCount = pendingStakes.length
    const unlockedCount = unlockedStakes.length

    return NextResponse.json({
      user: userComputed, // ✅ همیشه Level درست برمی‌گرده
      stakes,
      totals: {
        totalStaked: totalStakedActive,
        totalUnclaimedAll,
      },
      staking_summary: {
        active: activeCount,
        pending_unstake: pendingCount,
        unlocked: unlockedCount,
      },
      apr_components: {
        base: baseApr,
        streak: streakBonus,
        level: levelBonus,
        nft: 0,
        boost: 0,
        total: aprTotal,
      },
      claimed_today: claimedToday,
      daily_reward: dailyReward,
    })
  } catch (err) {
    console.error('API /reward/status error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
