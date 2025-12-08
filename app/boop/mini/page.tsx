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
  // برای محاسبات احتمالی آینده
  created_at?: string
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

  // Live accrual since last claim (frontend-only)
  const [liveAccrued, setLiveAccrued] = useState(0)
  const [sinceText, setSinceText] = useState<string | null>(null)

  async function loadStatus() {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch('/api/user/status', {
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

  // Live accrual calculator – هر ۱۰ ثانیه و هر بار که data عوض شد
  useEffect(() => {
    if (!data) {
      setLiveAccrued(0)
      setSinceText(null)
      return
    }

    const dailyReward = data.daily_reward || 0
    const totalStaked = data.totals.totalStaked || 0

    if (dailyReward <= 0 || totalStaked <= 0) {
      setLiveAccrued(0)
      setSinceText(null)
      return
    }

    function update() {
      const user = data.user

      if (!user.last_daily_claim) {
        setLiveAccrued(0)
        setSinceText('—')
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

      // ✅ بدون سقف، هرچند روز بگذرد اضافه می‌شود
      const estAccrued = dailyReward * daysPassed

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

    update()
    const timer = setInterval(update, 10_000)
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

  function formatNumber(n: number, decimals = 6) {
    return n.toFixed(decimals)
  }

  function formatInt(n: number) {
    return Number.isFinite(n) ? n.toLocaleString('en-US') : '0'
  }

  const referralLink = `https://boop.app/mini?ref=${fid}`

  async function copyReferral() {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(referralLink)
        setInfo('Referral link copied.')
      }
    } catch (e) {
      console.error(e)
      setError('Failed to copy link')
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

  const {
    user,
    totals,
    staking_summary,
    apr_components,
    daily_reward,
    claimed_today,
  } = data

  const hasNftBoost = apr_components.nft > 0
  const hasBoost = apr_components.boost > 0

  return (
    <div className="w-full max-w-xl mx-auto p-4 space-y-5 text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">BOOP on Base</h1>
          <p className="text-xs text-slate-400">
            Claim once per day to keep your streak and grow XP.
          </p>
        </div>
        <div className="text-right text-xs text-slate-400 space-y-0.5">
          <p className="text-[11px]">FID</p>
          <p className="text-sm font-semibold">{fid}</p>
          <p>
            XP <span className="font-semibold text-slate-100">{user.xp}</span>
          </p>
          <p>
            Level{' '}
            <span className="font-semibold text-slate-100">{user.level}</span>
          </p>
          <p>
            Streak{' '}
            <span className="font-semibold text-slate-100">
              {user.daily_streak}
            </span>{' '}
            days
          </p>
          {/* ✅ نمایش وضعیت NFT و Boost */}
          <p>
            NFT Boost:{' '}
            {hasNftBoost ? (
              <span className="font-semibold text-emerald-400">
                +{apr_components.nft.toFixed(1)}% active
              </span>
            ) : (
              <span className="font-semibold text-slate-500">none</span>
            )}
          </p>
          {hasBoost && (
            <p>
              Extra Boost:{' '}
              <span className="font-semibold text-sky-400">
                +{apr_components.boost.toFixed(1)}%
              </span>
            </p>
          )}
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

      {/* Daily reward + claim */}
      <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-700 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Daily reward (est.)</h2>
          <button
            onClick={loadStatus}
            className="px-3 py-1.5 text-xs rounded-md bg-slate-700 hover:bg-slate-600"
          >
            Refresh
          </button>
        </div>

        <div className="flex items-baseline justify-between mt-1">
          <div>
            <p className="text-xs text-slate-400">BOOP per day</p>
            <p className="text-3xl font-extrabold text-yellow-300">
              {formatNumber(daily_reward)}{' '}
              <span className="text-xs text-slate-300">BOOP / day</span>
            </p>
          </div>
        </div>

        {/* Since last daily claim – با آپدیت ۱۰ ثانیه‌ای */}
        {totals.totalStaked > 0 && daily_reward > 0 && (
          <div className="mt-3 rounded-lg bg-slate-800/70 px-3 py-3 text-xs">
            <p className="text-[11px] text-slate-400 mb-1">
              SINCE LAST DAILY CLAIM
            </p>
            <div className="flex items-baseline justify-between">
              <p className="text-2xl font-bold text-slate-50">
                {formatNumber(liveAccrued)}{' '}
                <span className="text-[10px] text-slate-300">BOOP</span>
              </p>
              <p className="text-[11px] text-slate-400">
                Time passed:{' '}
                <span className="font-semibold">{sinceText ?? '—'}</span>
              </p>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Updates every 10 seconds, based on your current APR.
            </p>
          </div>
        )}

        <button
          onClick={handleClaim}
          disabled={claiming || claimed_today}
          className={`w-full mt-3 px-4 py-2 rounded-md text-sm font-semibold ${
            claimed_today
              ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
              : claiming
              ? 'bg-yellow-300 text-slate-900 cursor-wait'
              : 'bg-yellow-400 text-slate-900 hover:bg-yellow-300'
          }`}
        >
          {claimed_today
            ? 'Already claimed today'
            : claiming
            ? 'Claiming…'
            : 'Claim daily reward'}
        </button>

        <p className="mt-1 text-[11px] text-slate-500">
          Missing one day will break your streak.
        </p>
      </div>

      {/* Main stats – کوتاه و تمیز */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700">
          <p className="text-[11px] text-slate-400">Wallet balance (demo)</p>
          <p className="mt-1 text-lg font-bold">0.00 BOOP</p>
          <p className="mt-1 text-[10px] text-slate-500">
            Mainnet version will show your real BOOP balance.
          </p>
        </div>
        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700">
          <p className="text-[11px] text-slate-400">Total staked (active)</p>
          <p className="mt-1 text-lg font-bold">
            {formatInt(totals.totalStaked || 0)}{' '}
            <span className="text-xs text-slate-400">BOOP</span>
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            Only positions with status <b>active</b> are counted.
          </p>
        </div>
        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700">
          <p className="text-[11px] text-slate-400">Current APR (with boosts)</p>
          <p className="mt-1 text-lg font-extrabold text-emerald-400">
            {apr_components.total.toFixed(2)}%
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            Base {apr_components.base.toFixed(1)}% · Streak{' '}
            {apr_components.streak.toFixed(1)}% · Level{' '}
            {apr_components.level.toFixed(1)}%
            {' · '}NFT {apr_components.nft.toFixed(1)}%
            {' · '}Boost {apr_components.boost.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Boosts & NFTs + Referral */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700 space-y-1">
          <p className="text-xs font-semibold">Boosts & NFTs</p>
          <p className="text-[11px] text-slate-400">
            Permanent NFT boost and temporary Boost items increase your APR on
            top of base, streak and level.
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Current NFT boost:{' '}
            <span className="font-semibold text-emerald-400">
              {apr_components.nft.toFixed(1)}%
            </span>
          </p>
          <p className="text-[11px] text-slate-500">
            Current extra Boost:{' '}
            <span className="font-semibold text-sky-400">
              {apr_components.boost.toFixed(1)}%
            </span>
          </p>
        </div>

        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700 space-y-2">
          <p className="text-xs font-semibold">Referral & social</p>
          <p className="text-[11px] text-slate-400">
            Share your Boop link. In later versions, referrals may unlock extra
            XP or airdrops.
          </p>

          <div className="mt-1 rounded-lg bg-slate-800/70 px-3 py-2 text-[11px]">
            <p className="text-slate-400 mb-1">Your referral link (demo)</p>
            <p className="truncate text-[11px] mb-2">{referralLink}</p>
            <button
              type="button"
              onClick={copyReferral}
              className="px-3 py-1.5 rounded-md bg-yellow-400 text-slate-900 text-xs font-semibold hover:bg-yellow-300"
            >
              Copy link
            </button>
          </div>

          <div className="pt-1 text-[11px] text-slate-500 space-y-0.5">
            <p>Twitter: @boopapp</p>
            <p>Website: boopapps.com</p>
            <p>Telegram: coming later</p>
          </div>
        </div>
      </div>

      {/* خلاصه استیک‌ها */}
      <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700 text-[11px] text-slate-400">
        <p className="font-semibold mb-1">Staking summary</p>
        <div className="flex gap-4">
          <p>
            Active:{' '}
            <span className="font-semibold text-slate-100">
              {staking_summary.active}
            </span>
          </p>
          <p>
            Pending:{' '}
            <span className="font-semibold text-slate-100">
              {staking_summary.pending_unstake}
            </span>
          </p>
          <p>
            Unlocked:{' '}
            <span className="font-semibold text-slate-100">
              {staking_summary.unlocked}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
