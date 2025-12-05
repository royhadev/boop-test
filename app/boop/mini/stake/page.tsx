'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

const MIN_STAKE = 1000

type UserInfo = {
  id: string
  fid: number
  username: string
  xp: number
  level: number
  daily_streak: number
  last_daily_claim: string | null
}

type StakeInfo = {
  id: string
  user_id: string
  staked_amount: number
  apr_base: number
  started_at: string
  unlock_at: string | null
  status: 'active' | 'pending_unstake' | 'unlocking' | 'unlocked' | 'withdrawn'
  last_reward_at: string | null
  unclaimed_reward: number
}

type RewardStatus = {
  user: UserInfo
  stakes: StakeInfo[]
  totals: {
    totalStaked: number
    totalUnclaimedAll: number
  }
  staking_summary: {
    active: number
    pending_unstake: number
    unlocked: number
  }
  apr_components: {
    base: number
    streak: number
    level: number
    nft: number
    boost: number
    total: number
  }
  claimed_today: boolean
  daily_reward: number
}

export default function StakePage() {
  const searchParams = useSearchParams()
  const rawFid = searchParams.get('fid') || '12345'
  const fid = Number(rawFid) || 12345

  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [unstakingId, setUnstakingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [amount, setAmount] = useState<string>('10000')
  const [data, setData] = useState<RewardStatus | null>(null)

  async function loadReward() {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch('/api/reward/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid }),
      })
      const j = await resp.json().catch(() => null)
      if (!resp.ok) {
        console.error('STATUS API ERROR:', j)
        throw new Error(j?.error || 'Failed to load staking data')
      }
      const json = j as RewardStatus
      setData(json)
    } catch (e: any) {
      console.error(e)
      setError(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReward()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fid])

  async function handleCreateStake() {
    const numericAmount = Number(amount)

    if (!numericAmount || numericAmount < MIN_STAKE) {
      setError(`Minimum stake amount is ${MIN_STAKE} BOOP.`)
      return
    }

    setCreating(true)
    setError(null)
    try {
      const resp = await fetch('/api/stake/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid, amount: numericAmount }),
      })
      const j = await resp.json().catch(() => null)
      if (!resp.ok) {
        console.error('CREATE STAKE API ERROR:', j)
        throw new Error(j?.error || 'Failed to create stake')
      }
      await loadReward()
      setAmount('10000')
    } catch (e: any) {
      console.error(e)
      setError(e.message || 'Failed to create stake')
    } finally {
      setCreating(false)
    }
  }

  async function handleRequestUnstake(stakeId: string) {
    setUnstakingId(stakeId)
    setError(null)
    try {
      const resp = await fetch('/api/stake/unstake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid, stakeId }),
      })

      const j = await resp.json().catch(() => null)
      console.log('UNSTAKE API RESPONSE:', j) // 👈 برای دیدن ارور واقعی

      if (!resp.ok) {
        // پیام واقعی سرور را هم در UI نشان بده
        const msg = j?.error || 'Failed to request unstake'
        setError(msg)
        throw new Error(msg)
      }

      await loadReward()
    } catch (e: any) {
      console.error(e)
      if (!error) {
        setError(e.message || 'Failed to request unstake')
      }
    } finally {
      setUnstakingId(null)
    }
  }

  function formatNum(n: number, digits = 6) {
    return Number(n || 0).toFixed(digits)
  }

  function Pill({
    children,
    color = 'emerald',
  }: {
    children: any
    color?: 'emerald' | 'sky' | 'orange'
  }) {
    const map: any = {
      emerald: 'bg-emerald-600',
      sky: 'bg-sky-600',
      orange: 'bg-orange-500',
    }
    return (
      <span className={`text-[11px] px-2 py-0.5 rounded-full ${map[color]} text-white`}>
        {children}
      </span>
    )
  }

  if (loading && !data) {
    return (
      <div className="w-full max-w-xl mx-auto p-4 text-center text-slate-200">
        Loading staking data…
      </div>
    )
  }

  if (!data) {
    return (
      <div className="w-full max-w-xl mx-auto p-4 text-center text-red-400">
        Failed to load staking data.
      </div>
    )
  }

  const { totals, apr_components, stakes } = data
  const totalReward = totals.totalUnclaimedAll
  const activeStakes = stakes.filter((s) => s.status === 'active')
  const pendingStakes = stakes.filter(
    (s) => s.status === 'pending_unstake' || s.status === 'unlocking',
  )

  return (
    <div className="w-full max-w-xl mx-auto p-4 space-y-5 text-white">
      <div>
        <h1 className="text-2xl font-bold mb-1">Stake</h1>
        <p className="text-xs text-slate-300">
          Stake BOOP to earn daily rewards. As long as a position is <b>active</b>, it earns rewards.
          When you request <b>unstake</b>, rewards stop immediately and a <b>21-day</b> unlock period starts.
        </p>
        <p className="mt-1 text-[11px] text-slate-500">FID: {fid}</p>
      </div>

      {error && (
        <div className="bg-red-900/70 border border-red-500 text-red-100 text-sm px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Overview */}
      <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-700 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Staking Overview</h2>
          <button
            onClick={loadReward}
            className="px-3 py-1.5 text-xs rounded-md bg-slate-700 hover:bg-slate-600"
          >
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-1">
          <div>
            <p className="text-xs text-slate-400">Total staked (active)</p>
            <p className="text-xl font-bold">
              {formatNum(totals.totalStaked, 0)}{' '}
              <span className="text-xs text-slate-400">BOOP</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Unclaimed rewards</p>
            <p className="text-xl font-bold">
              {formatNum(totalReward)}{' '}
              <span className="text-xs text-slate-400">BOOP</span>
            </p>
          </div>
        </div>

        <div className="mt-2">
          <p className="text-xs text-slate-400">Current APR</p>
          <p className="text-2xl font-extrabold text-emerald-400">
            {apr_components.total.toFixed(2)}%
          </p>
          <p className="text-[11px] text-slate-500">
            Base {apr_components.base.toFixed(1)}% · Streak {apr_components.streak.toFixed(1)}% · Level{' '}
            {apr_components.level.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Create stake */}
      <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-700 space-y-3">
        <div className="flex items-center justify_between">
          <h2 className="text-sm font-semibold">Create stake</h2>
          <p className="text-[11px] text-slate-500">Min {MIN_STAKE} BOOP</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-yellow-400"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
          />
          <button
            onClick={handleCreateStake}
            disabled={creating || Number(amount) < MIN_STAKE}
            className={`px-4 py-2 rounded-md font-semibold text-black text-sm whitespace-nowrap ${
              creating || Number(amount) < MIN_STAKE
                ? 'bg-yellow-300 cursor-not-allowed'
                : 'bg-yellow-400 hover:bg-yellow-300'
            }`}
          >
            {creating ? 'Staking…' : 'Stake'}
          </button>
        </div>

        <p className="text-[11px] text-slate-500">
          Rewards start as soon as the position is active. Unstake any time, then wait 21 days to withdraw.
        </p>
      </div>

      {/* Positions */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Your positions</h2>

        {stakes.length === 0 && (
          <p className="text-xs text-slate-400">
            No positions yet. Create your first stake above.
          </p>
        )}

        {activeStakes.map((s, idx) => (
          <div
            key={s.id}
            className="bg-slate-900/70 p-4 rounded-xl border border-slate-700 space-y-2"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">Position #{idx + 1}</p>
              <Pill color="sky">active</Pill>
            </div>

            <p className="text-sm">
              <span className="text-slate-400">Staked:</span>{' '}
              <span className="font-semibold">{formatNum(s.staked_amount, 0)} BOOP</span>
            </p>
            <p className="text-xs text-slate-400">Base APR: {s.apr_base.toFixed(1)}%</p>
            <p className="text-xs text-slate-400">
              Unclaimed: {formatNum(s.unclaimed_reward)} BOOP
            </p>

            <button
              onClick={() => handleRequestUnstake(s.id)}
              disabled={unstakingId === s.id}
              className={`mt-2 w-full px-3 py-2 rounded-md text-xs font-semibold ${
                unstakingId === s.id
                  ? 'bg-slate-300 text-slate-900 cursor-wait'
                  : 'bg-slate-100 text-slate-900 hover:bg-white'
              }`}
            >
              {unstakingId === s.id ? 'Requesting…' : 'Request unstake'}
            </button>
          </div>
        ))}

        {pendingStakes.map((s, idx) => (
          <div
            key={s.id}
            className="bg-slate-900/70 p-4 rounded-xl border border-slate-700 space-y-2"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Position #{activeStakes.length + idx + 1}
              </p>
              <Pill color="orange">pending</Pill>
            </div>

            <p className="text-sm">
              <span className="text-slate-400">Staked:</span>{' '}
              <span className="font-semibold">{formatNum(s.staked_amount, 0)} BOOP</span>
            </p>
            <p className="text-xs text-slate-400">
              Unclaimed: {formatNum(s.unclaimed_reward)} BOOP
            </p>

            <button
              disabled
              className="mt-2 w-full px-3 py-2 rounded-md text-xs font-semibold bg-slate-800 text-slate-400 cursor-not-allowed"
            >
              Withdraw after unlock (see Withdraw tab)
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
