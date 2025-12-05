'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

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
  unlock_at: string
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

export default function WithdrawPage() {
  const searchParams = useSearchParams()
  const rawFid = searchParams.get('fid') || '12345'
  const fid = Number(rawFid) || 12345

  const [loading, setLoading] = useState(true)
  const [reward, setReward] = useState<RewardStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [withdrawingRewards, setWithdrawingRewards] = useState(false)
  const [withdrawingStakeId, setWithdrawingStakeId] = useState<string | null>(null)

  async function loadReward() {
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      const resp = await fetch('/api/reward/status', {
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
      setError(e.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReward()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fid])

  async function handleWithdrawRewards() {
    if (!reward) return
    const totalReward = reward.totals.totalUnclaimedAll
    if (totalReward <= 0) {
      setError('You have no rewards to withdraw.')
      return
    }

    setWithdrawingRewards(true)
    setError(null)
    setInfo(null)
    try {
      const resp = await fetch('/api/reward/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid }),
      })
      const data = await resp.json().catch(() => null)
      if (!resp.ok) {
        throw new Error(data?.error || 'Failed to withdraw rewards')
      }

      setInfo(
        `Withdraw prepared: ${Number(
          data.withdrawnReward ?? 0
        ).toFixed(6)} BOOP. In production, this will be sent on-chain to your Farcaster wallet.`
      )
      await loadReward()
    } catch (e: any) {
      console.error(e)
      setError(e.message || 'Failed to withdraw rewards')
    } finally {
      setWithdrawingRewards(false)
    }
  }

  async function handleWithdrawStake(stakeId: string) {
    setWithdrawingStakeId(stakeId)
    setError(null)
    setInfo(null)
    try {
      const resp = await fetch('/api/stake/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid, stakeId }),
      })
      const data = await resp.json().catch(() => null)
      if (!resp.ok) {
        throw new Error(data?.error || 'Failed to withdraw stake')
      }
      setInfo(
        'Stake withdrawn in dev mode. In production this will send BOOP back to your Farcaster wallet on Base.'
      )
      await loadReward()
    } catch (e: any) {
      console.error(e)
      setError(e.message || 'Failed to withdraw stake')
    } finally {
      setWithdrawingStakeId(null)
    }
  }

  if (loading && !reward) {
    return (
      <div className="w-full max-w-xl mx-auto p-4 text-center text-slate-200">
        Loading withdraw data…
      </div>
    )
  }

  if (!reward) {
    return (
      <div className="w-full max-w-xl mx-auto p-4 text-center text-red-400">
        Failed to load withdraw data.
      </div>
    )
  }

  const { stakes, totals } = reward
  const totalReward = totals.totalUnclaimedAll

  const unlockedStakes = stakes.filter((s) => s.status === 'unlocked')
  const pendingStakes = stakes.filter(
    (s) => s.status === 'unlocking' || s.status === 'pending_unstake'
  )

  function formatDate(ts: string | null) {
    if (!ts) return '-'
    const d = new Date(ts)
    return d.toLocaleDateString()
  }

  return (
    <div className="w-full max-w-xl mx-auto p-4 space-y-5 text-white">
      <div>
        <h1 className="text-2xl font-bold mb-1">Withdraw</h1>
        <p className="text-xs text-slate-300">
          You can withdraw your BOOP rewards and unlocked stakes at any time.
          Daily Claim is always free and off-chain. Withdraw will be an on-chain
          transaction on Base in production.
        </p>
        <p className="mt-1 text-[11px] text-slate-500">FID: {fid}</p>
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

      {/* Rewards section */}
      <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-700 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Rewards balance</h2>
          <button
            onClick={loadReward}
            className="px-3 py-1.5 text-xs rounded-md bg-slate-700 hover:bg-slate-600"
          >
            Refresh
          </button>
        </div>

        <p className="text-xs text-slate-400">
          This is the total BOOP earned from staking (off-chain accrual). You can
          withdraw to your wallet whenever you like. In production this will be
          a real transfer on Base.
        </p>

        <div className="mt-2 flex items-baseline justify-between">
          <div>
            <p className="text-xs text-slate-400">Total rewards</p>
            <p className="text-xl font-bold">
              {totalReward.toFixed(6)}{' '}
              <span className="text-xs text-slate-400">BOOP</span>
            </p>
          </div>
        </div>

        <button
          onClick={handleWithdrawRewards}
          disabled={withdrawingRewards || totalReward <= 0}
          className={`w-full px-4 py-2 rounded-md text-sm font-semibold ${
            totalReward <= 0
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : withdrawingRewards
              ? 'bg-yellow-300 text-slate-900 cursor-wait'
              : 'bg-yellow-400 text-slate-900 hover:bg-yellow-300'
          }`}
        >
          {withdrawingRewards ? 'Withdrawing rewards…' : 'Withdraw rewards to wallet'}
        </button>

        <p className="text-[11px] text-slate-500">
          In dev mode we only update the database. Later this button will trigger an
          on-chain contract call that sends BOOP to your Farcaster wallet.
        </p>
      </div>

      {/* Unlocked stakes */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Unlocked stakes</h2>

        {unlockedStakes.length === 0 && pendingStakes.length === 0 && (
          <p className="text-xs text-slate-400">
            You have no positions in unlock or unlocked state yet. Use the Stake tab to
            create a stake, then request unstake. After the 21-day period, unlocked
            positions will be withdrawable here.
          </p>
        )}

        {pendingStakes.length > 0 && (
          <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-700 space-y-2">
            <p className="text-xs text-slate-400 mb-1">Pending unlock</p>
            {pendingStakes.map((s) => (
              <div key={s.id} className="text-[11px] text-slate-300 space-y-1">
                <div className="flex justify-between">
                  <span>Amount</span>
                  <span>{s.staked_amount.toFixed(0)} BOOP</span>
                </div>
                <div className="flex justify-between">
                  <span>Unlock date</span>
                  <span>{formatDate(s.unlock_at)}</span>
                </div>
              </div>
            ))}
            <p className="mt-2 text-[11px] text-slate-500">
              Once the unlock date is reached, these positions move to the unlocked
              section and become withdrawable at any time.
            </p>
          </div>
        )}

        {unlockedStakes.map((s, idx) => (
          <div
            key={s.id}
            className="bg-slate-900/70 p-4 rounded-xl border border-slate-700 space-y-2"
          >
            <div className="flex justify-between items-center mb-1">
              <p className="text-xs text-slate-400">Unlocked position #{idx + 1}</p>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-600">
                unlocked
              </span>
            </div>

            <p className="text-sm text-slate-300">
              Amount:{' '}
              <span className="font-semibold">
                {s.staked_amount.toFixed(0)} BOOP
              </span>
            </p>

            <p className="text-xs text-slate-400">
              Unlock date: {formatDate(s.unlock_at)}
            </p>

            <button
              onClick={() => handleWithdrawStake(s.id)}
              disabled={withdrawingStakeId === s.id}
              className={`mt-3 w-full px-3 py-2 rounded-md text-xs font-semibold ${
                withdrawingStakeId === s.id
                  ? 'bg-yellow-300 text-slate-900 cursor-wait'
                  : 'bg-slate-100 text-slate-900 hover:bg-white'
              }`}
            >
              {withdrawingStakeId === s.id
                ? 'Withdrawing…'
                : 'Withdraw unstaked BOOP to wallet'}
            </button>

            <p className="mt-2 text-[11px] text-slate-500">
              In dev mode we only mark the stake as withdrawn. In production this will
              call the staking contract and send BOOP back to your Farcaster wallet on
              Base.
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
