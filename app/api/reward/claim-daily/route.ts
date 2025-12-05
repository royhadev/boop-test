import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

type UserRow = {
  id: string
  fid: number
  username: string
  xp: number
  level: number
  daily_streak: number
  last_daily_claim: string | null
}

type StakeRow = {
  id: string
  user_id: string
  staked_amount: string
  apr_base: string
  status: string
  unclaimed_reward: string
}

type BoostRow = {
  id: string
  user_id: string
  boost_type: string
  apr_boost: string
  started_at: string
  expires_at: string
  is_active: boolean
}

type NftRow = {
  id: string
  user_id: string
  nft_type: string
  apr_nft: string
  level: number
  is_active: boolean
  created_at: string
}

function calcAprBaseFromRow(stake: StakeRow): number {
  const apr = Number(stake.apr_base)
  if (isNaN(apr)) return 0
  return apr
}

function calcAprStreak(dailyStreak: number): number {
  const apr = dailyStreak * 2
  return Math.min(apr, 40)
}

function calcAprLevel(level: number): number {
  if (!level || level <= 1) return 0
  const apr = (level - 1) * 0.5
  return Math.min(apr, 10)
}

function calcAprBoostFromRows(boosts: BoostRow[], now: Date): number {
  if (!boosts || boosts.length === 0) return 0

  let totalBoost = 0
  const nowIso = now.toISOString()

  for (const boost of boosts) {
    if (!boost.is_active) continue

    const startedOk = boost.started_at <= nowIso
    const notExpired = boost.expires_at >= nowIso

    if (!startedOk || !notExpired) continue

    const value = Number(boost.apr_boost)
    if (!isNaN(value) && value > 0) {
      totalBoost += value
    }
  }

  // Cap total APR boost from boosts
  const capped = Math.min(totalBoost, 30)
  return capped
}

function calcAprNftFromRows(nfts: NftRow[]): number {
  if (!nfts || nfts.length === 0) return 0

  let totalNftApr = 0

  for (const nft of nfts) {
    if (!nft.is_active) continue
    const value = Number(nft.apr_nft)
    if (!isNaN(value) && value > 0) {
      totalNftApr += value
    }
  }

  // Cap total APR from NFTs
  const capped = Math.min(totalNftApr, 15)
  return capped
}

function diffDays(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)

    if (!body || typeof body.fid === 'undefined') {
      return NextResponse.json(
        { error: 'fid is required' },
        { status: 400 }
      )
    }

    const fid = Number(body.fid)
    if (!fid || isNaN(fid)) {
      return NextResponse.json(
        { error: 'Invalid fid' },
        { status: 400 }
      )
    }

    // Find user by fid
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('fid', fid)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found for this fid' },
        { status: 404 }
      )
    }

    const now = new Date()
    const today = new Date(now.toDateString()) // date only

    let dailyStreak = user.daily_streak ?? 0
    let lastClaim: Date | null = null
    if (user.last_daily_claim) {
      lastClaim = new Date(user.last_daily_claim)
    }

    if (lastClaim) {
      const lastDateOnly = new Date(lastClaim.toDateString())
      const daysDiff = diffDays(lastDateOnly, today)

      if (daysDiff === 0) {
        // already claimed today
        return NextResponse.json(
          { error: 'Daily reward already claimed for today.' },
          { status: 400 }
        )
      } else if (daysDiff === 1) {
        // continue streak
        dailyStreak = dailyStreak + 1
      } else {
        // streak reset
        dailyStreak = 1
      }
    } else {
      // first claim
      dailyStreak = 1
    }

    // Get all active stakes for this user
    const { data: stakes, error: stakesError } = await supabaseAdmin
      .from('stakes')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (stakesError) {
      console.error('stakesError', stakesError)
      return NextResponse.json(
        { error: 'Failed to fetch stakes' },
        { status: 500 }
      )
    }

    if (!stakes || stakes.length === 0) {
      return NextResponse.json(
        { error: 'No active stakes found for this user' },
        { status: 400 }
      )
    }

    // Fetch boosts for user
    const { data: boosts, error: boostsError } = await supabaseAdmin
      .from('user_boosts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (boostsError) {
      console.error('boostsError', boostsError)
    }

    // Fetch NFTs for user
    const { data: nfts, error: nftsError } = await supabaseAdmin
      .from('user_nfts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (nftsError) {
      console.error('nftsError', nftsError)
    }

    // Calculate APR components
    const aprStreak = calcAprStreak(dailyStreak)
    const aprLevel = calcAprLevel(user.level ?? 1)
    const aprBoost = calcAprBoostFromRows((boosts ?? []) as BoostRow[], now)
    const aprNft = calcAprNftFromRows((nfts ?? []) as NftRow[])

    let totalReward = 0
    let maxAprFinal = 0

    for (const stake of stakes as StakeRow[]) {
      const stakedAmount = Number(stake.staked_amount)
      if (!stakedAmount || isNaN(stakedAmount) || stakedAmount <= 0) continue

      const aprBase = calcAprBaseFromRow(stake)
      let aprTotalRaw = aprBase + aprStreak + aprLevel + aprBoost + aprNft
      const aprFinal = Math.min(aprTotalRaw, 90)
      maxAprFinal = Math.max(maxAprFinal, aprFinal)

      const dailyReward =
        stakedAmount * (aprFinal / 100) / 365

      if (dailyReward <= 0) continue

      totalReward += dailyReward

      const prevUnclaimed = Number(stake.unclaimed_reward ?? 0)

      const { error: updateStakeError } = await supabaseAdmin
        .from('stakes')
        .update({
          unclaimed_reward: (prevUnclaimed + dailyReward).toString(),
          last_reward_at: now.toISOString()
        })
        .eq('id', stake.id)

      if (updateStakeError) {
        console.error('updateStakeError for stake', stake.id, updateStakeError)
      }
    }

    if (totalReward <= 0) {
      return NextResponse.json(
        { error: 'No reward was calculated for this user' },
        { status: 400 }
      )
    }

    // XP & Level (simple: +25 XP per daily claim, every 100 XP = +1 level)
    const prevXp = user.xp ?? 0
    const gainedXp = 25
    const newXp = prevXp + gainedXp
    const newLevel = Math.max(1, 1 + Math.floor(newXp / 100))

    const { error: updateUserError } = await supabaseAdmin
      .from('users')
      .update({
        daily_streak: dailyStreak,
        last_daily_claim: now.toISOString(),
        xp: newXp,
        level: newLevel
      })
      .eq('id', user.id)

    if (updateUserError) {
      console.error('updateUserError', updateUserError)
    }

    const { error: logError } = await supabaseAdmin
      .from('reward_logs')
      .insert({
        user_id: user.id,
        stake_id: null,
        amount: totalReward.toString(),
        apr_final_snapshot: maxAprFinal,
        type: 'daily_stake'
      })

    if (logError) {
      console.error('reward_logs insert error', logError)
    }

    return NextResponse.json(
      {
        message: 'Daily reward claimed successfully',
        totalReward: Number(totalReward.toFixed(6)),
        daily_streak: dailyStreak,
        xp: newXp,
        level: newLevel,
        apr_components: {
          apr_streak: aprStreak,
          apr_level: aprLevel,
          apr_boost: aprBoost,
          apr_nft: aprNft,
          apr_final_max: maxAprFinal
        }
      },
      { status: 200 }
    )
  } catch (err) {
    console.error('reward/claim-daily error', err)
    return NextResponse.json(
      { error: 'Internal server error in claim-daily' },
      { status: 500 }
    )
  }
}
