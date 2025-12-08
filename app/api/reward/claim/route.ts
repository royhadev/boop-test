import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import {
  accrueRewardsForUserStakes,
  type StakeRow,
} from '../../../../lib/rewardEngine'

export const dynamic = 'force-dynamic'

// ---------------- Config / Constants ----------------

const MIN_STAKE_FOR_NFT = 5_000_000 // شرط NFT
const NFT_BOOST_APR = 20 // +20% APR
const APR_CAP = 120 // سقف کل APR
const DAILY_XP = 25 // XP روزانه برای Claim
const CLAIM_FEE_RATE = 0.02 // 2% Claim Fee روی پاداش

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

// ---------------- Helpers ----------------

function computeBaseApr(amount: number): number {
  if (!amount || amount <= 0 || !Number.isFinite(amount)) return 0
  const log10 = Math.log10(amount)
  let aprRaw = 9 * log10
  if (!Number.isFinite(aprRaw)) return 0
  const apr = Math.min(60, Math.max(0, aprRaw))
  return Number(apr.toFixed(2))
}

function xpToLevel(xp: number): number {
  if (!xp || xp <= 0) return 1

  const MAX_LEVEL = 20
  const XP_FOR_MAX = 5250
  const xpPerLevel = XP_FOR_MAX / (MAX_LEVEL - 1)

  const base = 1 + Math.floor(xp / xpPerLevel)
  const level = Math.max(1, Math.min(base, MAX_LEVEL))
  return level
}

function calcLevelBonus(level: number): number {
  const MAX_LEVEL = 20
  const MAX_LEVEL_BONUS = 20
  if (!level || level <= 1) return 0
  const effectiveLevel = Math.min(level, MAX_LEVEL)
  const bonusPerLevel = MAX_LEVEL_BONUS / (MAX_LEVEL - 1)
  const bonus = (effectiveLevel - 1) * bonusPerLevel
  return Number(bonus.toFixed(2))
}

function calcStreakBonus(streak: number): number {
  if (!streak || streak <= 0) return 0
  if (streak >= 7) return 10
  if (streak >= 3) return 5
  return 2
}

// تبدیل تاریخ به شروع روز UTC (برای محاسبه درست روز Claim)
function toUtcDateOnly(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

// ---------------- Handler ----------------

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const fid = Number(body?.fid || 0)

    if (!fid) {
      return NextResponse.json({ error: 'Missing fid' }, { status: 400 })
    }

    // 1) پیدا کردن کاربر
    const { data: userRow, error: userErr } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('fid', fid)
      .single<UserRow>()

    if (userErr || !userRow) {
      console.error('Failed to load user in /reward/claim:', userErr)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = userRow

    const now = new Date()
    const todayUtc = toUtcDateOnly(now)

    // 2) کنترل دوباره Claim در همان روز + محاسبه streak جدید
    let newStreak = 1
    if (user.last_daily_claim) {
      const last = new Date(user.last_daily_claim)
      const lastUtc = toUtcDateOnly(last)
      const diffDays = Math.floor((todayUtc - lastUtc) / (24 * 60 * 60 * 1000))

      if (diffDays === 0) {
        return NextResponse.json(
          { error: 'Already claimed today' },
          { status: 400 }
        )
      } else if (diffDays === 1) {
        newStreak = (user.daily_streak || 0) + 1
      } else {
        newStreak = 1
      }
    }

    // 3) استیک‌ها (همه به جز withdrawn)
    const { data: stakesRaw, error: stakesErr } = await supabaseAdmin
      .from('stakes')
      .select('*')
      .eq('user_id', user.id)
      .neq('status', 'withdrawn')

    if (stakesErr) {
      console.error('Failed to load stakes in /reward/claim:', stakesErr)
      return NextResponse.json({ error: 'Failed to load stakes' }, { status: 500 })
    }

    const stakes = (stakesRaw || []) as StakeRow[]
    const activeStakes = stakes.filter((s) => s.status === 'active')
    const totalStakedActive = activeStakes.reduce(
      (sum, s) => sum + (s.staked_amount || 0),
      0
    )

    if (totalStakedActive <= 0) {
      return NextResponse.json(
        { error: 'No active stake to claim rewards from' },
        { status: 400 }
      )
    }

    // 4) APR Components (طبق v2)
    const baseApr = computeBaseApr(totalStakedActive)
    const streakBonus = calcStreakBonus(user.daily_streak || 0)
    const levelBonus = calcLevelBonus(user.level || 1)

    // NFT Bonus
    let nftBonus = 0
    if (totalStakedActive >= MIN_STAKE_FOR_NFT) {
      const { data: nfts, error: nftErr } = await supabaseAdmin
        .from('nft_ownership')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)

      if (nftErr) {
        console.warn('Failed to load NFTs in /reward/claim:', nftErr)
      } else if (nfts && nfts.length > 0) {
        nftBonus = NFT_BOOST_APR
      }
    }

    const boostBonus = 0 // بعداً Boost 24/72/7 روزه رو اینجا اضافه می‌کنیم

    const rawAprTotal =
      baseApr + streakBonus + levelBonus + nftBonus + boostBonus
    const aprTotal = Math.min(APR_CAP, rawAprTotal)

    // 5) Accrue Rewards تا همین لحظه
    const {
      updatedStakes,
      totalUnclaimedAll,
    } = accrueRewardsForUserStakes(stakes, aprTotal, now)

    // مبلغ قابل Claim روی استیک‌های active
    const updatedById = new Map(updatedStakes.map((s) => [s.id, s]))
    let claimable = 0
    for (const s of activeStakes) {
      const updated = updatedById.get(s.id) || s
      claimable += updated.unclaimed_reward || 0
    }

    if (claimable <= 0) {
      return NextResponse.json(
        { error: 'No rewards available to claim' },
        { status: 400 }
      )
    }

    // 6) اعمال Claim Fee 2%
    const grossReward = claimable
    const feeAmount = Number((grossReward * CLAIM_FEE_RATE).toFixed(8))
    const netReward = Number((grossReward - feeAmount).toFixed(8))

    // 7) صفر کردن unclaimed_reward در همه استیک‌ها
    const resetStakes = updatedStakes.map((s) => ({
      id: s.id,
      unclaimed_reward: 0,
      last_reward_at: now.toISOString(),
    }))

    if (resetStakes.length > 0) {
      await Promise.all(
        resetStakes.map((s) =>
          supabaseAdmin
            .from('stakes')
            .update({
              unclaimed_reward: s.unclaimed_reward,
              last_reward_at: s.last_reward_at,
            })
            .eq('id', s.id)
        )
      )
    }

    // 8) آپدیت XP، Level، Streak و last_daily_claim
    const newXp = (user.xp || 0) + DAILY_XP
    const newLevel = xpToLevel(newXp)

    await supabaseAdmin
      .from('users')
      .update({
        xp: newXp,
        level: newLevel,
        daily_streak: newStreak,
        last_daily_claim: now.toISOString(),
      })
      .eq('id', user.id)

    // 9) (اختیاری) لاگ در reward_logs – اگر اسکیمای جدول فرق داشت، خطا نادیده گرفته می‌شود
    try {
      await supabaseAdmin.from('reward_logs').insert({
        user_id: user.id,
        stake_id: null,
        amount: netReward,
        kind: 'daily_claim',
      } as any)
    } catch (logErr) {
      console.warn('Failed to insert reward_logs in /reward/claim:', logErr)
    }

    // 10) پاسخ نهایی
    return NextResponse.json({
      ok: true,
      message: 'Daily claim successful',
      rewards: {
        gross: grossReward,
        fee: feeAmount,
        net: netReward,
        totalUnclaimedAll,
      },
      apr_components: {
        base: baseApr,
        streak: streakBonus,
        level: levelBonus,
        nft: nftBonus,
        boost: boostBonus,
        total: aprTotal,
      },
      user_after: {
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
      { status: 500 }
    )
  }
}
