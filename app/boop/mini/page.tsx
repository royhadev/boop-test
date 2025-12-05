'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type UserInfo = {
  id: string
  fid: number
  username: string | null
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
  status: string
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

export default function MiniHomePage() {
  const searchParams = useSearchParams()
  const rawFid = searchParams.get('fid') || '12345'
  const fid = Number(rawFid) || 12345

  const [data, setData] = useState<RewardStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  // Live accrual since last claim (frontend-only, approximate)
  const [liveAccrued, setLiveAccrued] = useState(0)
  const [sinceText, setSinceText] = useState<string | null>(null)

  async function loadStatus() {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch('/api/reward/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid }),
      })
      const json = (await resp.json()) as RewardStatus
      if (!resp.ok) {
        throw new Error((json as any)?.error || 'Failed to load data')
      }
      setData(json)
    } catch (e: any) {
      console.error(e)
      setError(e.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fid])

  // Live accrual calculator – recompute whenever data changes and every 10s
  useEffect(() => {
    if (!data) {
      setLiveAccrued(0)
      setSinceText(null)
      return
    }

    function updateLiveAccrual() {
      const user = data.user
      const dailyReward = data.daily_reward || 0
      const totalStaked = data.totals.totalStaked || 0

      // اگر هنوز استیک فعالی نداریم یا daily_reward صفره، چیزی نشون نده
      if (!user.last_daily_claim || dailyReward <= 0 || totalStaked <= 0) {
        setLiveAccrued(0)
        setSinceText(null)
        return
      }

      const last = new Date(user.last_daily_claim)
      const now = new Date()
      const diffMs = now.getTime() - last.getTime()
      if (diffMs <= 0) {
        setLiveAccrued(0)
        setSinceText('just claimed')
        return
      }

      const diffSeconds = diffMs / 1000
      const daysPassed = diffSeconds / 86400

      // ✅ مقدار تخمینی پاداش جمع‌شده از آخرین Claim
      // (می‌تونه بیشتر از ۱ روز هم باشه)
      const estAccrued = dailyReward * daysPassed

      // متن نمایشی "از آخرین Claim تا حالا"
      let label: string
      if (daysPassed < 1) {
        const hours = Math.floor(diffSeconds / 3600)
        const minutes = Math.floor((diffSeconds % 3600) / 60)
        if (hours <= 0) {
          label = `${minutes} min`
        } else {
          label = `${hours}h ${minutes}m`
        }
      } else {
        const roundedDays = Number(daysPassed.toFixed(2))
        label = `${roundedDays} days`
      }

      setLiveAccrued(estAccrued)
      setSinceText(label)
    }

    updateLiveAccrual()
    const timer = setInterval(updateLiveAccrual, 10_000)
    return () => clearInterval(timer)
  }, [data])

  async function handleClaim() {
    if (!data || data.claimed_today) return
    setClaiming(true)
    setError(null)
    setInfo(null)
    try {
      const resp = await fetch('/api/reward/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid }),
      })
      const j = await resp.json().catch(() => null)
      if (!resp.ok) {
        throw new Error(j?.error || 'Failed to claim')
      }
      setInfo('Daily claim done.')
      await loadStatus()
    } catch (e: any) {
      console.error(e)
      setError(e.message || 'Failed to claim')
    } finally {
      setClaiming(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="w-full max-w-xl mx-auto p-4 text-center text-slate-200">
        Loading…
      </div>
    )
  }

  if (!data) {
    return (
      <div className="w-full max-w-xl mx-auto p-4 text-center text-red-400">
        Failed to load data.
      </div>
    )
  }

  const { user, totals, staking_summary, apr_components, daily_reward, claimed_today } = data

  return (
    <div className="w-full max-w-xl mx-auto p-4 space-y-5 text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Boop miniapp</h1>
          <p className="text-xs text-slate-400">
            Claim daily. Stake BOOP. Earn rewards.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">FID</p>
          <p className="text-sm font-semibold">{fid}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/70 border border-red-500 text-red-100 text-sm px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      {info && (
        <div className="bg-emerald-900/70 border border-emerald-500 text-emerald-100 text-sm px-3 py-2 rounded-lg">
          {info}
        </div>
      )}

      {/* Daily claim */}
      <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-700 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Daily claim</h2>
          <button
            onClick={loadStatus}
            className="px-3 py-1.5 text-xs rounded-md bg-slate-700 hover:bg-slate-600"
          >
            Refresh
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Claim once per day to keep your streak and update rewards.
        </p>

        <div className="flex items-baseline justify-between mt-1">
          <div>
            <p className="text-xs text-slate-400">Estimated daily reward</p>
            <p className="text-2xl font-extrabold text-yellow-300">
              {daily_reward.toFixed(6)}{' '}
              <span className="text-xs text-slate-300">BOOP / day</span>
            </p>
          </div>
          <div className="text-right text-xs text-slate-400">
            <p>
              Streak: <span className="font-semibold">{user.daily_streak}</span> days
            </p>
            <p>
              Level: <span className="font-semibold">{user.level}</span>
            </p>
          </div>
        </div>

        {/* Live accrual since last claim */}
        {sinceText && (
          <div className="mt-2 rounded-lg bg-slate-800/70 px-3 py-2 text-xs text-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Since last claim</span>
              <span className="font-medium text-slate-100">{sinceText}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-slate-400">Estimated accumulated</span>
              <span className="font-semibold text-yellow-300">
                {liveAccrued.toFixed(6)}{' '}
                <span className="text-[10px] text-slate-300">BOOP</span>
              </span>
            </div>
          </div>
        )}

        <button
          onClick={handleClaim}
          disabled={claiming || claimed_today}
          className={`w-full px-4 py-2 rounded-md text-sm font-semibold ${
            claimed_today
              ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
              : claiming
              ? 'bg-yellow-300 text-slate-900 cursor-wait'
              : 'bg-yellow-400 text-slate-900 hover:bg-yellow-300'
          }`}
        >
          {claimed_today ? 'Already claimed today' : claiming ? 'Claiming…' : 'Claim today'}
        </button>
      </div>

      {/* Wallet + stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700">
          <p className="text-[11px] text-slate-400">Wallet balance (demo)</p>
          <p className="text-lg font-bold">0.000000 BOOP</p>
          <p className="text-[10px] text-slate-500">
            Later this will read your real BOOP balance.
          </p>
        </div>
        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700">
          <p className="text-[11px] text-slate-400">Staked</p>
          <p className="text-lg font-bold">
            {Number(totals.totalStaked || 0).toFixed(0)}{' '}
            <span className="text-xs text-slate-400">BOOP</span>
          </p>
          <p className="text-[11px] text-slate-500">Active positions only.</p>
        </div>
      </div>

      {/* XP / APR */}
      <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-700 space-y-2">
        <div className="flex justify-between">
          <div>
            <p className="text-xs text-slate-400">XP</p>
            <p className="text-xl font-bold">{user.xp}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Level</p>
            <p className="text-xl font-bold">{user.level}</p>
          </div>
        </div>

        <div className="mt-2">
          <p className="text-xs text-slate-400">APR</p>
          <p className="text-2xl font-extrabold text-emerald-400">
            {apr_components.total.toFixed(2)}%
          </p>
          <p className="text-[11px] text-slate-500">
            Base {apr_components.base.toFixed(1)}% · Streak {apr_components.streak.toFixed(1)}% · Level{' '}
            {apr_components.level.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Staking summary */}
      <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-700 space-y-2">
        <h2 className="text-sm font-semibold">Staking summary</h2>

        <div className="grid grid-cols-3 gap-2 text-[11px] mt-1">
          <div>
            <p className="text-slate-400">Active</p>
            <p className="text-sm font-semibold">{staking_summary.active}</p>
          </div>
          <div>
            <p className="text-slate-400">Pending</p>
            <p className="text-sm font-semibold">{staking_summary.pending_unstake}</p>
          </div>
          <div>
            <p className="text-slate-400">Unlocked</p>
            <p className="text-sm font-semibold">{staking_summary.unlocked}</p>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 mt-1">
          Create and manage positions in the <b>Stake</b> and <b>Withdraw</b> tabs.
        </p>
      </div>
    </div>
  )
}
