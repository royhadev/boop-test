// lib/rewardEngine.ts
// Reward accrual logic for user stakes (pure functions, no DB inside)

export type StakeStatus =
  | 'active'
  | 'pending_unstake'
  | 'unlocking'
  | 'unlocked'
  | 'withdrawn'
  | null

export interface StakeRow {
  id: string
  user_id: string
  staked_amount: number
  apr_base: number | null
  started_at: string
  unlock_at: string | null
  status: StakeStatus
  last_reward_at: string | null
  unclaimed_reward: number | null
}

export interface AccrualResult {
  updatedStakes: StakeRow[]
  totalNewlyAccrued: number
  totalUnclaimedAll: number
}

/**
 * Accrue rewards for a user's stakes incrementally.
 *
 * - فقط روی استیک‌های status === 'active' پاداش حساب می‌کند.
 * - از last_reward_at تا now محاسبه می‌کند (اگر last_reward_at خالی بود → started_at).
 * - از aprTotal (APR نهایی کاربر) برای همه استیک‌های active استفاده می‌کند.
 */
export function accrueRewardsForUserStakes(
  stakes: StakeRow[],
  aprTotal: number,
  now: Date
): AccrualResult {
  if (!aprTotal || aprTotal <= 0) {
    const totalUnclaimed = stakes.reduce(
      (sum, s) => sum + (s.unclaimed_reward ?? 0),
      0
    )
    return {
      updatedStakes: stakes,
      totalNewlyAccrued: 0,
      totalUnclaimedAll: totalUnclaimed,
    }
  }

  const nowMs = now.getTime()
  const yearlyAprFraction = aprTotal / 100
  const dailyAprFraction = yearlyAprFraction / 365

  let totalNewlyAccrued = 0

  const updatedStakes = stakes.map((stake) => {
    const currentUnclaimed = stake.unclaimed_reward ?? 0

    // فقط استیک‌های active پاداش می‌گیرند
    if (stake.status !== 'active') {
      return {
        ...stake,
        unclaimed_reward: currentUnclaimed,
      }
    }

    const lastTimestampStr = stake.last_reward_at || stake.started_at
    const lastMs = new Date(lastTimestampStr).getTime()

    if (!Number.isFinite(lastMs) || lastMs >= nowMs) {
      return {
        ...stake,
        unclaimed_reward: currentUnclaimed,
      }
    }

    const daysDiff = (nowMs - lastMs) / (1000 * 60 * 60 * 24)

    if (daysDiff <= 0) {
      return {
        ...stake,
        unclaimed_reward: currentUnclaimed,
      }
    }

    const amount = stake.staked_amount || 0
    if (!amount || amount <= 0) {
      return {
        ...stake,
        unclaimed_reward: currentUnclaimed,
      }
    }

    const newRewards = amount * dailyAprFraction * daysDiff
    if (!Number.isFinite(newRewards) || newRewards <= 0) {
      return {
        ...stake,
        unclaimed_reward: currentUnclaimed,
      }
    }

    const newUnclaimed = currentUnclaimed + newRewards
    totalNewlyAccrued += newRewards

    return {
      ...stake,
      unclaimed_reward: newUnclaimed,
      last_reward_at: now.toISOString(),
    }
  })

  const totalUnclaimedAll = updatedStakes.reduce(
    (sum, s) => sum + (s.unclaimed_reward ?? 0),
    0
  )

  return {
    updatedStakes,
    totalNewlyAccrued,
    totalUnclaimedAll,
  }
}
