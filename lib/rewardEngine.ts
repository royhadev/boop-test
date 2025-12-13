// lib/rewardEngine.ts
// Server-side reward + APR helper (single source of truth).
// Decisions enforced:
// - Base APR max = 60%
// - Base APR reaches 60% at 2,500,000 BOOP staked (cap)
// - NFT bonus max = +20%
// - Boost bonus max = +20%
// - Level bonus max = +20%
// - Streak bonus max = +10%
// - Total APR clamp to 130%
//
// Extra rule (IMPORTANT):
// - If user stake < MIN_STAKE, total APR must be 0 (no level/streak/nft/boost bonuses)
//   because bonuses only apply to stakers.

export type AprComponents = {
  base: number
  nft: number
  boost: number
  level: number
  streak: number
}

export type AprResult = {
  totalApr: number
  components: AprComponents
}

export const APR = {
  MIN_STAKE: 1_000,
  BASE_MAX: 60,
  BASE_STAKE_CAP: 2_500_000,
  NFT_MAX: 20,
  BOOST_MAX: 20,
  LEVEL_MAX: 20,
  STREAK_MAX: 10,
  TOTAL_MAX: 130,
} as const

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

/**
 * Monotonic base APR curve:
 * - 0% at MIN_STAKE
 * - 60% at BASE_STAKE_CAP
 * - never decreases when stake increases
 */
export function calcBaseApr(totalStaked: number): number {
  if (!Number.isFinite(totalStaked) || totalStaked < APR.MIN_STAKE) return 0
  const x = clamp(totalStaked, APR.MIN_STAKE, APR.BASE_STAKE_CAP)
  const t = (x - APR.MIN_STAKE) / (APR.BASE_STAKE_CAP - APR.MIN_STAKE) // 0..1
  // Slightly eased (still monotonic) so early stake gains feel meaningful:
  const eased = Math.sqrt(t)
  return clamp(eased * APR.BASE_MAX, 0, APR.BASE_MAX)
}

/**
 * Streak bonus (simple + explainable + capped):
 * 1 day: +1
 * 7 days: +2
 * 14 days: +4
 * 30 days: +10
 */
export function calcStreakBonus(dailyStreak: number): number {
  if (!Number.isFinite(dailyStreak) || dailyStreak <= 0) return 0
  if (dailyStreak >= 30) return 10
  if (dailyStreak >= 14) return 4
  if (dailyStreak >= 7) return 2
  return 1
}

/**
 * Level bonus: linear 0..20 (level 20 -> +20)
 * If your DB already stores "level_bonus" directly, pass that instead.
 */
export function calcLevelBonus(level: number): number {
  if (!Number.isFinite(level) || level <= 0) return 0
  // treat level 20 as max
  return clamp((level / 20) * APR.LEVEL_MAX, 0, APR.LEVEL_MAX)
}

export function calcApr(params: {
  totalStaked: number
  hasNft: boolean
  boostActive: boolean
  level: number
  dailyStreak: number
}): AprResult {
  const staked = Number.isFinite(params.totalStaked) ? params.totalStaked : 0

  // ✅ HARD RULE: if not staked (below MIN_STAKE), no APR at all
  if (staked < APR.MIN_STAKE) {
    return {
      totalApr: 0,
      components: { base: 0, nft: 0, boost: 0, level: 0, streak: 0 },
    }
  }

  const base = calcBaseApr(staked)
  const nft = params.hasNft ? APR.NFT_MAX : 0
  const boost = params.boostActive ? APR.BOOST_MAX : 0
  const level = calcLevelBonus(params.level)
  const streak = calcStreakBonus(params.dailyStreak)

  const totalApr = clamp(base + nft + boost + level + streak, 0, APR.TOTAL_MAX)

  return {
    totalApr,
    components: { base, nft, boost, level, streak },
  }
}
