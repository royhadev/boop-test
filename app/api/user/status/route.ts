import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import {
  accrueRewardsForUserStakes,
  type StakeRow,
} from '../../../../lib/rewardEngine'

export const dynamic = 'force-dynamic'

// ---------------- Config / Constants ----------------

const MIN_STAKE_FOR_NFT = 5_000_000 // شرط NFT
const NFT_BOOST_APR = 20 // +20%
const APR_CAP = 120 // سقف کل APR

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
  const xpPerLevel = XP_FOR_MAX / (MAX_LEVEL - 1) // ~276 XP

  const base = 1 + Math.floor(xp / xpPerLevel)
  const level = Math.max(1, Math.min(base, MAX_LEVEL))

  return level
}

function calcLevelBonus(level: number): number {
  const MAX_LEVEL = 20
  const MAX_LEVEL_BONUS = 20 // +20%

  if (!level || level <= 1) return 0

  const effectiveLevel = Math.min(level, MAX_LEVEL)
  const bonusPerLevel = MAX_LEVEL_BONUS / (MAX_LEVEL - 1) // ~1.05%

  const bonus = (effectiveLevel - 1) * bonusPerLevel
  return Number(bonus.toFixed(2))
}

function calcStreakBonus(streak: number): number {
  if (!streak || streak <= 0) return 0
  if (streak >= 7) return 10
  if (streak >= 3) return 5
  return 2
}

// ---------------- Handler ----------------

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const fid = Number(body?.fid || 0)

    if (!fid) {
      return NextResponse.json({ error: 'Missing fid' }, { status: 400 })
    }

    // 1) یافتن یا ساخت کاربر
    const { data: existingUser, error: existingErr } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('fid', fid)
      .single<UserRow>()

    let user: UserRow

    if (!existingUser || existingErr) {
      const { data: newUser, error: insertErr } = await supabaseAdmin
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

      if (insertErr || !newUser) {
        console.error('Failed to init user:', insertErr)
        return NextResponse.json({ error: 'Failed to init user' }, { status: 500 })
      }

      user = newUser
    } else {
      user = existingUser
    }

    // Level واقعی از روی XP (بدون ذخیره‌کردن در DB)
    const computedLevel = xpToLevel(user.xp || 0)
    const userComputed: UserRow = { ...user, level: computedLevel }

    // 2) استیک‌ها
    const { data: stakesRaw, error: stakesError } = await supabaseAdmin
      .from('stakes')
      .select('*')
      .eq('user_id', user.id)
      .neq('status', 'withdrawn')

    if (stakesError) {
      console.error('Failed to load stakes:', stakesError)
      return NextResponse.json({ error: 'Failed to load stakes' }, { status: 500 })
    }

    const stakes = (stakesRaw || []) as StakeRow[]

    const activeStakes = stakes.filter((s) => s.status === 'active')
    const pendingStakes = stakes.filter(
      (s) => s.status === 'pending_unstake' || s.status === 'unlocking'
    )
    const unlockedStakes = stakes.filter((s) => s.status === 'unlocked')

    const totalStakedActive = activeStakes.reduce(
      (sum, s) => sum + (s.staked_amount || 0),
      0
    )

    // 3) APR components
    const baseApr =
      totalStakedActive > 0 ? computeBaseApr(totalStakedActive) : 0
    const streakBonus = calcStreakBonus(userComputed.daily_streak)
    const levelBonus = calcLevelBonus(userComputed.level)

    // 4) NFT Bonus (+20%) با شرط 5M استیک و NFT فعال
    let nftBonus = 0
    let hasActiveNft = false

    if (totalStakedActive >= MIN_STAKE_FOR_NFT) {
      const { data: nfts, error: nftErr } = await supabaseAdmin
        .from('nft_ownership')
        .select('id, nft_tier, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)

      if (nftErr) {
        console.warn('Failed to load NFTs for user/status:', nftErr)
      } else if (nfts && nfts.length > 0) {
        hasActiveNft = true
        nftBonus = NFT_BOOST_APR
      }
    }

    // 5) Boost فعلاً 0 (بعداً اضافه می‌کنیم)
    const boostBonus = 0

    let aprTotal = 0
    if (totalStakedActive > 0) {
      const rawTotal =
        baseApr + streakBonus + levelBonus + nftBonus + boostBonus
      aprTotal = Math.min(APR_CAP, rawTotal)
    }

    const now = new Date()

    // 6) Accrue Rewards
    const {
      updatedStakes,
      totalUnclaimedAll,
    } = accrueRewardsForUserStakes(stakes, aprTotal, now)

    const stakesById = new Map(stakes.map((s) => [s.id, s]))
    const stakesToUpdate = updatedStakes.filter((updated) => {
      const original = stakesById.get(updated.id)
      if (!original) return false

      const changedUnclaimed =
        (original.unclaimed_reward ?? 0) !== (updated.unclaimed_reward ?? 0)
      const changedLastReward =
        (original.last_reward_at || null) !== (updated.last_reward_at || null)

      return changedUnclaimed || changedLastReward
    })

    if (stakesToUpdate.length > 0) {
      await Promise.all(
        stakesToUpdate.map((s) =>
          supabaseAdmin
            .from('stakes')
            .update({
              unclaimed_reward: s.unclaimed_reward ?? 0,
              last_reward_at: s.last_reward_at,
            })
            .eq('id', s.id)
        )
      )
    }

    // 7) dailyReward
    const dailyReward =
      totalStakedActive > 0 ? (totalStakedActive * (aprTotal / 100)) / 365 : 0

    // 8) claimedToday
    let claimedToday = false
    if (userComputed.last_daily_claim) {
      const last = new Date(userComputed.last_daily_claim)
      const nowLocal = new Date()
      claimedToday =
        last.getUTCFullYear() === nowLocal.getUTCFullYear() &&
        last.getUTCMonth() === nowLocal.getUTCMonth() &&
        last.getUTCDate() === nowLocal.getUTCDate()
    }

    // 9) log اختیاری
    try {
      await supabaseAdmin.from('api_logs').insert({
        user_id: user.id,
        endpoint: '/api/user/status',
      })
    } catch (logErr) {
      console.warn('Failed to insert api_logs for /api/user/status:', logErr)
    }

    // 10) response
    return NextResponse.json({
      user: userComputed,
      stakes: updatedStakes,
      totals: {
        totalStaked: totalStakedActive,
        totalUnclaimedAll,
      },
      staking_summary: {
        active: activeStakes.length,
        pending_unstake: pendingStakes.length,
        unlocked: unlockedStakes.length,
      },
      apr_components: {
        base: baseApr,
        streak: streakBonus,
        level: levelBonus,
        nft: nftBonus,
        boost: boostBonus,
        total: aprTotal,
        has_active_nft: hasActiveNft,
      },
      claimed_today: claimedToday,
      daily_reward: dailyReward,
    })
  } catch (err) {
    console.error('API /user/status error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
