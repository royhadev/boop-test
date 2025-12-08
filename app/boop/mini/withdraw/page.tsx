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

type WithdrawResult = {
  success: boolean
  withdrawnReward: number
  grossReward?: number
  feePercent?: number
  feeAmount?: number
  error?: string
}

type ToastState = {
  message: string
  type: 'success' | 'error' | 'info'
} | null

function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '0'
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
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
      <div
        className={`px-4 py-2 rounded-full shadow-lg text-sm font-medium ${base} border border-black/10`}
      >
        {toast.message}
      </div>
    </div>
  )
}

export default function WithdrawPage() {
  const searchParams = useSearchParams()
  const rawFid = searchParams.get('fid') || '12345'
  const fid = Number(rawFid) || 12345

  const [reward, setReward] = useState<RewardStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [withdrawing, setWithdrawing] = useState(false)
  const [lastResult, setLastResult] = useState<WithdrawResult | null>(null)
  const [toast, setToast] = useState<ToastState>(null)

  useEffect(() => {
    let timeout: NodeJS.Timeout | undefined
    if (toast) {
      timeout = setTimeout(() => setToast(null), 3000)
    }
    return () => {
      if (timeout) clearTimeout(timeout)
    }
  }, [toast])

  async function loadStatus(opts?: { silent?: boolean }) {
    try {
      if (!opts?.silent) setLoading(true)
      const resp = await fetch('/api/user/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid }),
      })
      const json = (await resp.json()) as RewardStatus
      if (!resp.ok) {
        throw new Error((json as any)?.error || 'Failed to load reward status')
      }
      setReward(json)
    } catch (e: any) {
      console.error(e)
      setToast({
        type: 'error',
        message: e?.message || 'Failed to load data',
      })
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }

  useEffect(() => {
    // first load
    loadStatus()
    // periodic refresh for live-ish unclaimed rewards
    const timer = setInterval(() => {
      loadStatus({ silent: true })
    }, 15_000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fid])

  const unclaimed = reward?.totals.totalUnclaimedAll || 0
  const hasReward = unclaimed > 0

  // unlocked positions (for future principal withdraw UI)
  const unlockedStakes =
    reward?.stakes.filter((s) => s.status === 'unlocked') ?? []

  // display fee & net
  const displayFeePercent = lastResult?.feePercent ?? 2
  const computedFeeAmount =
    lastResult?.feeAmount ??
    (hasReward ? (unclaimed * displayFeePercent) / 100 : 0)
  const computedNet =
    lastResult?.withdrawnReward ??
    (hasReward ? unclaimed - computedFeeAmount : 0)

  async function handleWithdrawRewards() {
    if (!hasReward) {
      setToast({
        type: 'info',
        message: 'No rewards to withdraw yet.',
      })
      return
    }

    try {
      setWithdrawing(true)
      const resp = await fetch('/api/reward/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid }),
      })
      const result = (await resp.json().catch(() => null)) as WithdrawResult
      if (!resp.ok || !result?.success) {
        throw new Error(result?.error || 'Withdraw failed')
      }
      setLastResult(result)
      setToast({
        type: 'success',
        message: 'Reward withdrawn successfully.',
      })
      await loadStatus({ silent: true })
    } catch (e: any) {
      console.error(e)
      setToast({
        type: 'error',
        message: e?.message || 'Withdraw failed',
      })
    } finally {
      setWithdrawing(false)
    }
  }

  function handleWithdrawUnlockedInfo() {
    setToast({
      type: 'info',
      message:
        'Principal withdraw for unlocked stakes will be handled in the on-chain version.',
    })
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex justify-center">
      <div className="w-full max-w-3xl px-4 py-6 sm:py-10">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-yellow-400 text-slate-900 font-black text-lg shadow">
                B
              </span>
              <span>Withdraw rewards</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Withdraw your accumulated BOOP rewards with a small protocol fee.
            </p>
          </div>
          {/* عمداً Back to home حذف شده تا صفحه خلوت‌تر باشد */}
        </header>

        {loading && !reward && (
          <div className="space-y-4">
            <div className="h-24 rounded-2xl bg-slate-900/60 animate-pulse" />
            <div className="h-32 rounded-2xl bg-slate-900/60 animate-pulse" />
          </div>
        )}

        {reward && (
          <div className="space-y-5">
            {/* Reward overview */}
            <section className="rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-400/10 via-slate-900 to-slate-950 p-4 sm:p-5 shadow-[0_0_40px_rgba(250,204,21,0.12)]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-yellow-300/80">Unclaimed rewards</p>
                  <p className="mt-1 text-2xl sm:text-3xl font-bold text-yellow-300">
                    {formatNumber(unclaimed, 4)}{' '}
                    <span className="text-xs text-yellow-200/80 font-semibold">
                      BOOP
                    </span>
                  </p>
                </div>
                <div className="text-right text-[11px] text-slate-400">
                  <p>Total staked</p>
                  <p className="font-semibold text-slate-100">
                    {formatNumber(reward.totals.totalStaked)} BOOP
                  </p>
                  <p className="mt-1 text-slate-500">
                    Active · {reward.staking_summary.active} positions
                  </p>
                  <button
                    type="button"
                    onClick={() => loadStatus({ silent: false })}
                    className="mt-2 inline-flex items-center rounded-full border border-yellow-300/40 px-3 py-1 text-[11px] text-yellow-200 hover:bg-yellow-300/10"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2">
                  <p className="text-slate-400 mb-0.5">Gross reward</p>
                  <p className="font-semibold text-slate-50">
                    {formatNumber(unclaimed, 4)} BOOP
                  </p>
                </div>
                <div className="rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2">
                  <p className="text-slate-400 mb-0.5 flex items-center gap-1">
                    Fee ({formatNumber(displayFeePercent, 2)}%)
                    <span
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-500 text25 text-[9px] text-slate-300 cursor-help"
                      title="2% of your unclaimed rewards is taken as a protocol fee. In mainnet it will be split between treasury, burn and team."
                    >
                      ?
                    </span>
                  </p>
                  <p className="font-semibold text-rose-200">
                    {formatNumber(computedFeeAmount, 4)} BOOP
                  </p>
                </div>
                <div className="rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2">
                  <p className="text-slate-400 mb-0.5 flex items-center gap-1">
                    You receive
                    <span
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-500 text-[9px] text-slate-300 cursor-help"
                      title="Net rewards after fee is applied."
                    >
                      ?
                    </span>
                  </p>
                  <p className="font-semibold text-emerald-200">
                    {formatNumber(computedNet, 4)} BOOP
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleWithdrawRewards}
                disabled={!hasReward || withdrawing}
                className={`mt-4 inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold shadow-lg transition
                  ${
                    !hasReward || withdrawing
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-yellow-300 text-slate-950 hover:bg-yellow-200'
                  }`}
              >
                {withdrawing ? 'Withdrawing…' : 'Withdraw rewards'}
              </button>

              <p className="mt-2 text-[11px] text-slate-200/80">
                A protocol fee is applied on reward withdrawals. In the mainnet version
                this fee will be routed between the reward treasury, burn and team
                allocations.
              </p>

              {!hasReward && (
                <p className="mt-1 text-[11px] text-slate-400">
                  No rewards are currently available. Rewards accumulate daily while your
                  stakes are active.
                </p>
              )}
            </section>

            {/* Last withdraw result */}
            {lastResult && lastResult.success && (
              <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-4 sm:p-5 text-[11px] text-emerald-50">
                <p className="text-xs font-semibold mb-2">
                  Last withdraw summary
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-emerald-500/10 px-3 py-2">
                    <p className="text-emerald-200/80 mb-0.5">Gross reward</p>
                    <p className="font-semibold">
                      {formatNumber(
                        lastResult.grossReward ?? lastResult.withdrawnReward,
                        4,
                      )}{' '}
                      BOOP
                    </p>
                  </div>
                  <div className="rounded-xl bg-emerald-500/10 px-3 py-2">
                    <p className="text-emerald-200/80 mb-0.5">
                      Fee (
                      {formatNumber(lastResult.feePercent ?? displayFeePercent, 2)}
                      %)
                    </p>
                    <p className="font-semibold">
                      {formatNumber(
                        lastResult.feeAmount ??
                          (lastResult.grossReward ?? 0) *
                            ((lastResult.feePercent ?? displayFeePercent) / 100),
                        4,
                      )}{' '}
                      BOOP
                    </p>
                  </div>
                  <div className="rounded-xl bg-emerald-500/10 px-3 py-2">
                    <p className="text-emerald-200/80 mb-0.5">Received</p>
                    <p className="font-semibold">
                      {formatNumber(lastResult.withdrawnReward, 4)} BOOP
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Unlocked positions – future principal withdraw UI */}
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
                  When the 21-day unlock period ends, your principal BOOP stakes will
                  appear here as <b>unlocked</b>. In the smart contract version you&apos;ll
                  be able to withdraw the staked BOOP itself.
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
                      <div className="flex flex-col items-end gap-1">
                        <p className="text-emerald-200/80 text-[10px] text-right">
                          Principal withdraw is UI-only in this demo. On-chain withdraw
                          will be added in the future.
                        </p>
                        <button
                          type="button"
                          onClick={handleWithdrawUnlockedInfo}
                          className="mt-1 inline-flex items-center rounded-full border border-emerald-400/70 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-400/10"
                        >
                          Withdraw unlocked stake (soon)
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Info card */}
            <section className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 sm:p-5 text-[11px] text-slate-300">
              <p className="font-semibold mb-1">How this works</p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  Daily rewards are added to your <b>unclaimed rewards</b> based on your
                  stake, APR, streak and level.
                </li>
                <li>
                  Reward withdraw does <b>not</b> touch your staked BOOP – it only
                  withdraws accumulated rewards.
                </li>
                <li>
                  Unstaking a position starts a 21-day unlock timer. When unlocked,
                  you&apos;ll be able to withdraw the staked BOOP itself in the future
                  smart contract version.
                </li>
              </ul>
            </section>
          </div>
        )}

        <BoopToast toast={toast} />
      </div>
    </div>
  )
}
