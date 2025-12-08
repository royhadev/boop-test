'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

const MIN_STAKE = 1000

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
  apr_base: number | null
  started_at: string
  unlock_at: string | null
  status:
    | 'active'
    | 'pending_unstake'
    | 'unlocking'
    | 'unlocked'
    | 'withdrawn'
    | null
  last_reward_at: string | null
  unclaimed_reward: number | null
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

type ToastState = {
  message: string
  type: 'success' | 'error' | 'info'
} | null

function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '0'
  return value.toLocaleString('en-US', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  })
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function BoopToast({ toast }: { toast: ToastState }) {
  if (!toast) return null
  const base =
    toast.type === 'success'
      ? 'bg-emerald-500 text-emerald-950'
      : toast.type === 'error'
      ? 'bg-red-500 text-red-950'
      : 'bg-slate-800 text-slate-100'

  return (
    <div className="fixed bottom-4 inset-x-0 flex justify-center px-4 z-50">
      <div className={`px-4 py-2 rounded-full shadow-lg text-sm font-medium ${base} border border-black/10`}>
        {toast.message}
      </div>
    </div>
  )
}

export default function StakePage() {
  const searchParams = useSearchParams()
  const rawFid = searchParams.get('fid') || '12345'
  const fid = Number(rawFid) || 12345

  const [reward, setReward] = useState<RewardStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [unstakingId, setUnstakingId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState>(null)

  useEffect(() => {
    let timeout: NodeJS.Timeout | undefined
    if (toast) timeout = setTimeout(() => setToast(null), 3000)
    return () => {
      if (timeout) clearTimeout(timeout)
    }
  }, [toast])

  async function loadStatus() {
    try {
      setLoading(true)
      const resp = await fetch('/api/user/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid }),
      })
      if (!resp.ok) {
        const data = await resp.json().catch(() => null)
        throw new Error(data?.error || 'Failed to load reward status')
      }
      const json = (await resp.json()) as RewardStatus
      setReward(json)
    } catch (e: any) {
      console.error(e)
      setToast({ type: 'error', message: e?.message || 'Failed to load data' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fid])

  const activeStakes = reward?.stakes.filter((s) => s.status === 'active') ?? []
  const pendingStakes =
    reward?.stakes.filter((s) => s.status === 'pending_unstake') ?? []
  const unlockedStakes =
    reward?.stakes.filter((s) => s.status === 'unlocked') ?? []

  async function handleStake(e: React.FormEvent) {
    e.preventDefault()
    const numeric = Number(amount)
    if (!Number.isFinite(numeric) || numeric < MIN_STAKE) {
      setToast({
        type: 'error',
        message: `Minimum stake is ${MIN_STAKE} BOOP`,
      })
      return
    }

    try {
      setSubmitting(true)
      const resp = await fetch('/api/stake/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid, amount: numeric }),
      })
      const data = await resp.json().catch(() => null)
      if (!resp.ok) {
        throw new Error(data?.error || 'Failed to create stake')
      }
      setToast({ type: 'success', message: 'Stake created successfully.' })
      setAmount('')
      await loadStatus()
    } catch (e: any) {
      console.error(e)
      setToast({ type: 'error', message: e?.message || 'Stake failed' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUnstake(id: string) {
    try {
      setUnstakingId(id)
      const resp = await fetch('/api/stake/unstake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid, stakeId: id }),
      })
      const data = await resp.json().catch(() => null)
      if (!resp.ok) {
        throw new Error(data?.error || 'Failed to request unstake')
      }
      setToast({
        type: 'success',
        message: 'Unstake requested. Unlock in 21 days.',
      })
      await loadStatus()
    } catch (e: any) {
      console.error(e)
      setToast({ type: 'error', message: e?.message || 'Unstake failed' })
    } finally {
      setUnstakingId(null)
    }
  }

  const totalStaked = reward?.totals.totalStaked ?? 0
  const apr = reward?.apr_components

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex justify-center">
      <div className="w-full max-w-3xl px-4 py-6 sm:py-10">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-yellow-400 text-slate-900 font-black text-lg shadow">
              B
            </span>
            <span>Stake BOOP</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Lock BOOP to earn APR, streak bonuses and level boosts. Unstake at any
            time; your position will unlock after a 21-day cooldown.
          </p>
        </header>

        {loading && !reward && (
          <div className="space-y-4">
            <div className="h-24 rounded-2xl bg-slate-900/60 animate-pulse" />
            <div className="h-32 rounded-2xl bg-slate-900/60 animate-pulse" />
          </div>
        )}

        {reward && (
          <div className="space-y-5">
            {/* Stake form */}
            <section className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 sm:p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                    New stake
                  </p>
                  <p className="text-sm text-slate-200">
                    Minimum stake:{' '}
                    <span className="font-semibold">{MIN_STAKE}</span> BOOP
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Current APR:{' '}
                    <span className="text-slate-100 font-semibold">
                      {apr ? apr.total.toFixed(2) : '0.00'}%
                    </span>{' '}
                    (Base {apr ? apr.base.toFixed(2) : '0.00'}%, Streak{' '}
                    {apr ? apr.streak.toFixed(1) : '0.0'}%, Level{' '}
                    {apr ? apr.level.toFixed(1) : '0.0'}%, NFT{' '}
                    {apr ? apr.nft.toFixed(1) : '0.0'}%, Boost{' '}
                    {apr ? apr.boost.toFixed(1) : '0.0'}%)
                  </p>
                </div>
                <div className="text-right text-[11px] text-slate-400">
                  <p>Total active staked</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-100">
                    {formatNumber(totalStaked)} BOOP
                  </p>
                  <p className="mt-0.5 text-slate-500">
                    Positions: {reward.staking_summary.active}
                  </p>
                </div>
              </div>

              <form
                onSubmit={handleStake}
                className="mt-2 flex flex-col sm:flex-row gap-3 items-stretch sm:items-end"
              >
                <div className="flex-1">
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Amount to stake (BOOP)
                  </label>
                  <input
                    type="number"
                    min={MIN_STAKE}
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-yellow-400"
                    placeholder={`${MIN_STAKE}+`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`w-full sm:w-40 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    submitting
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-yellow-400 text-slate-950 hover:bg-yellow-300 shadow'
                  }`}
                >
                  {submitting ? 'Staking…' : 'Stake'}
                </button>
              </form>

              <p className="mt-1 text-[11px] text-slate-500">
                You can create multiple positions. Each stake has its own base APR.
                Streak, level, NFT and Boost bonuses apply on top of your base APR.
              </p>
            </section>

            {/* Active stakes */}
            <section className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  Active positions
                </p>
                <p className="text-[11px] text-slate-500">
                  {activeStakes.length} position
                  {activeStakes.length === 1 ? '' : 's'}
                </p>
              </div>

              {activeStakes.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  You don&apos;t have any active stakes yet. Create a new stake above.
                </p>
              ) : (
                <div className="space-y-2">
                  {activeStakes.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2.5 text-[11px] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                    >
                      <div>
                        <p className="text-slate-200 font-semibold">
                          {formatNumber(s.staked_amount)} BOOP
                        </p>
                        <p className="text-slate-500">
                          Base APR:{' '}
                          <span className="text-slate-100">
                            {s.apr_base?.toFixed(2) ?? '0.00'}%
                          </span>
                          {' · '}Started {formatDateTime(s.started_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="text-right text-[10px] text-slate-500">
                          <p>Unclaimed reward</p>
                          <p className="text-slate-100 font-semibold">
                            {formatNumber(s.unclaimed_reward || 0, 4)} BOOP
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUnstake(s.id)}
                          disabled={unstakingId === s.id}
                          className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                            unstakingId === s.id
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : 'bg-slate-100 text-slate-900 hover:bg-white'
                          }`}
                        >
                          {unstakingId === s.id ? 'Unstaking…' : 'Unstake'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Pending unlock (21 days) */}
            <section className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  Pending unlock (21 days)
                </p>
                <p className="text-[11px] text-slate-500">
                  {pendingStakes.length} position
                  {pendingStakes.length === 1 ? '' : 's'}
                </p>
              </div>

              {pendingStakes.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  When you request an unstake, your position moves here and stops earning
                  rewards during the 21-day unlock period.
                </p>
              ) : (
                <div className="space-y-2">
                  {pendingStakes.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-xl border border-amber-500/40 bg-amber-500/5 px-3 py-2.5 text-[11px] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                    >
                      <div>
                        <p className="text-amber-100 font-semibold">
                          {formatNumber(s.staked_amount)} BOOP
                        </p>
                        <p className="text-amber-200/80">
                          Unlocks at {formatDateTime(s.unlock_at)}
                        </p>
                      </div>
                      <p className="text-amber-200/80 text-[10px] sm:text-right">
                        Reward accrual is paused during this period. When the timer ends,
                        the position becomes unlocked.
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Unlocked positions */}
            <section className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  Unlocked positions
                </p>
                <p className="text-[11px] text-slate-500">
                  {unlockedStakes.length} position
                  {unlockedStakes.length === 1 ? '' : 's'}
                </p>
              </div>

              {unlockedStakes.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  After the 21-day unlock period, your principal BOOP stake will appear
                  here as unlocked. In the mainnet smart contract, you&apos;ll be able to
                  withdraw the staked BOOP itself.
                </p>
              ) : (
                <div className="space-y-2">
                  {unlockedStakes.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 px-3 py-2.5 text-[11px] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                    >
                      <div>
                        <p className="text-emerald-100 font-semibold">
                          {formatNumber(s.staked_amount)} BOOP
                        </p>
                        <p className="text-emerald-200/80">
                          Unlocked at {formatDateTime(s.unlock_at)}
                        </p>
                      </div>
                      <p className="text-emerald-200/80 text-[10px] sm:text-right">
                        Principal withdrawal will be handled on-chain in the future
                        version. This demo only handles reward withdrawals.
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        <BoopToast toast={toast} />
      </div>
    </div>
  )
}
