'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'

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
  staked_amount: number
  apr_base: number
  unclaimed_reward: number
}

type BoostInfo = {
  id: string
  boost_type: string
  apr_boost: number
  is_active: boolean
}

type NftInfo = {
  id: string
  nft_type: string
  apr_nft: number
  level: number
  is_active: boolean
}

type StatusResponse = {
  user: UserInfo
  stakes: StakeInfo[]
  boosts: BoostInfo[]
  nfts: NftInfo[]
  totals: {
    totalStaked: number
    totalUnclaimed: number
    potentialDailyReward: number
  }
  apr_components: {
    apr_streak: number
    apr_level: number
    apr_boost: number
    apr_nft: number
    apr_final_max: number
  }
}

// انتخاب آیکون بر اساس لول
function getIconForLevel(level: number) {
  if (level <= 1) return '/xp/xp_level1.png'
  if (level === 2) return '/xp/xp_level2.png'
  if (level === 3) return '/xp/xp_level3.png'
  if (level === 4) return '/xp/xp_level4.png'
  if (level === 5) return '/xp/xp_level5.png'
  if (level === 6) return '/xp/xp_level6.png'
  if (level === 7) return '/xp/xp_level7.png'
  if (level === 8) return '/xp/xp_level8.png'
  if (level === 9) return '/xp/xp_level9.png'
  // level 10 یا بالاتر
  return '/xp/xp_level10.png'
}

export default function BoopPage() {
  const searchParams = useSearchParams()
  const fidParam = searchParams.get('fid')
  const fid = fidParam ? Number(fidParam) : 12345

  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [actionLoading, setActionLoading] = useState<boolean>(false)
  const [message, setMessage] = useState<string | null>(null)
  const [stakeAmount, setStakeAmount] = useState<string>('10000')

  async function loadStatus() {
    try {
      setLoading(true)
      setMessage(null)

      const res = await fetch('/api/reward/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || 'Failed to load status')
      } else {
        setStatus({
          ...data,
          totals: {
            totalStaked: Number(data.totals?.totalStaked || 0),
            totalUnclaimed: Number(data.totals?.totalUnclaimed || 0),
            potentialDailyReward: Number(
              data.totals?.potentialDailyReward || 0
            ),
          },
        })
      }
    } catch (err) {
      console.error(err)
      setMessage('Error loading status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fid])

  async function handleDailyClaim() {
    try {
      setActionLoading(true)
      setMessage(null)

      const res = await fetch('/api/reward/claim-daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || 'Daily claim failed')
      } else {
        setMessage(
          `Daily reward claimed: ${data.totalReward.toFixed(6)} BOOP`
        )
        await loadStatus()
      }
    } catch (err) {
      console.error(err)
      setMessage('Error while claiming reward')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleWithdraw() {
    try {
      setActionLoading(true)
      setMessage(null)

      const res = await fetch('/api/reward/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || 'Withdraw failed')
      } else {
        setMessage(
          `Withdrawn successfully: ${data.withdrawn.toFixed(
            6
          )} BOOP from accumulated rewards`
        )
        await loadStatus()
      }
    } catch (err) {
      console.error(err)
      setMessage('Error while withdrawing rewards')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleStake() {
    const amountNum = Number(stakeAmount)

    if (!amountNum || amountNum <= 0 || isNaN(amountNum)) {
      setMessage('Enter a valid stake amount')
      return
    }

    try {
      setActionLoading(true)
      setMessage(null)

      const res = await fetch('/api/stake/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid, amount: amountNum }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || 'Stake creation failed')
      } else {
        setMessage('Stake created successfully')
        await loadStatus()
      }
    } catch (err) {
      console.error(err)
      setMessage('Error while creating stake')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleBuyBoost() {
    try {
      setActionLoading(true)
      setMessage(null)

      const res = await fetch('/api/boost/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid, boostType: 'weekly_7d' }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || 'Boost purchase failed')
      } else {
        setMessage('Boost purchased successfully')
        await loadStatus()
      }
    } catch (err) {
      console.error(err)
      setMessage('Error while purchasing boost')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleGrantNft() {
    try {
      setActionLoading(true)
      setMessage(null)

      const res = await fetch('/api/nft/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid, nftType: 'stake_boost_L2' }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || 'NFT grant failed')
      } else {
        setMessage('NFT granted successfully')
        await loadStatus()
      }
    } catch (err) {
      console.error(err)
      setMessage('Error while granting NFT')
    } finally {
      setActionLoading(false)
    }
  }

  const loadingText = loading ? 'Loading...' : ''
  const dailyReward =
    status?.totals?.potentialDailyReward != null
      ? status.totals.potentialDailyReward
      : 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-slate-50 flex justify-center px-4 py-10">
      <div className="w-full max-w-4xl space-y-8">
        {/* Hero / Banner with logo */}
        <section className="text-center">
          <div className="inline-flex flex-col items-center gap-4">
            <div className="relative h-24 w-24 md:h-28 md:w-28 rounded-3xl overflow-hidden shadow-[0_0_32px_rgba(250,204,21,0.7)]">
              <Image
                src="/boop-miniapp-logo.png"
                alt="BOOP Miniapp"
                fill
                className="object-cover"
              />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                BOOP <span className="text-yellow-400">Miniapp</span>
              </h1>
              <p className="mt-2 text-sm md:text-base text-slate-300 max-w-xl">
                Daily staking rewards on Base. Stake BOOP, keep your streak
                alive, and boost your APR with claim streaks, boosts, and NFTs.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Dev tester view · fid: {fid || 0}
              </p>
            </div>
          </div>
        </section>

        {/* Message bar */}
        {message && (
          <div className="rounded-xl border border-violet-500/60 bg-violet-900/40 px-4 py-3 text-sm">
            {message}
          </div>
        )}

        {/* Main grid */}
        <section className="grid gap-6 md:grid-cols-[2fr,1.4fr]">
          {/* Left: daily reward + actions */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    Daily reward
                  </p>
                  <p className="text-2xl font-semibold">
                    {dailyReward.toFixed(6)}{' '}
                    <span className="text-sm text-slate-300">BOOP / day</span>
                  </p>
                </div>
                <button
                  onClick={loadStatus}
                  className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800"
                >
                  Refresh
                </button>
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <button
                  onClick={handleDailyClaim}
                  disabled={actionLoading}
                  className="flex-1 rounded-full bg-emerald-400/90 hover:bg-emerald-300 text-slate-950 font-semibold py-2.5 text-sm disabled:opacity-60"
                >
                  {actionLoading ? 'Working...' : 'Daily Claim'}
                </button>
                <button
                  onClick={handleWithdraw}
                  disabled={actionLoading}
                  className="flex-1 rounded-full bg-sky-500/90 hover:bg-sky-400 text-slate-950 font-semibold py-2.5 text-sm disabled:opacity-60"
                >
                  Withdraw accumulated rewards
                </button>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Claim once per day to grow your streak and earn higher APR.
                Missing a day resets your streak.
              </p>
            </div>

            {/* Manage position: stake + dev buttons */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl space-y-4">
              <h2 className="text-sm font-semibold text-slate-100">
                Manage your position
              </h2>
              <p className="text-xs text-slate-400">
                Quick stake (dev): stake BOOP with a 21-day lock to earn daily
                rewards.
              </p>

              <div className="flex gap-2">
                <input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  className="flex-1 rounded-xl bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-violet-500"
                  placeholder="Amount of BOOP to stake"
                />
                <button
                  onClick={handleStake}
                  disabled={actionLoading}
                  className="rounded-xl bg-violet-500 hover:bg-violet-400 text-slate-950 font-semibold px-4 py-2 text-sm disabled:opacity-60"
                >
                  Stake
                </button>
              </div>

              <div className="flex flex-col md:flex-row gap-3">
                <button
                  onClick={handleBuyBoost}
                  disabled={actionLoading}
                  className="flex-1 rounded-full bg-fuchsia-500/90 hover:bg-fuchsia-400 text-slate-950 font-semibold py-2.5 text-xs md:text-sm disabled:opacity-60"
                >
                  Buy Weekly Boost (+15% APR, 7 days)
                </button>
                <button
                  onClick={handleGrantNft}
                  disabled={actionLoading}
                  className="flex-1 rounded-full bg-amber-400/90 hover:bg-amber-300 text-slate-950 font-semibold py-2.5 text-xs md:text-sm disabled:opacity-60"
                >
                  Grant NFT L2 (+7% APR, dev)
                </button>
              </div>

              <p className="mt-2 text-[10px] text-slate-500">
                This screen is a dev prototype. In the real Farcaster miniapp,
                amounts and boosts will be connected to onchain BOOP staking and
                user sessions.
              </p>
            </div>
          </div>

          {/* Right: user profile + APR breakdown */}
          <div className="space-y-4">
            {/* Profile card with level icon */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 flex gap-4 items-center shadow-xl">
              <div className="relative h-14 w-14 rounded-2xl overflow-hidden flex-shrink-0">
                <Image
                  src={getIconForLevel(status?.user?.level ?? 1)}
                  alt="Level icon"
                  fill
                  className="object-contain"
                />
              </div>
              <div className="flex-1">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  User
                </p>
                <p className="font-semibold text-sm">
                  {status?.user?.username || '—'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  XP {status?.user?.xp ?? 0} • Level {status?.user?.level ?? 1}
                  {' • '}
                  Streak {status?.user?.daily_streak ?? 0} days
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  FID: {status?.user?.fid ?? fid}
                </p>
              </div>
            </div>

            {/* Totals */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl space-y-3 text-sm">
              <h2 className="text-sm font-semibold text-slate-100">
                Staking overview
              </h2>
              <div className="flex justify-between">
                <span className="text-slate-400">Total staked</span>
                <span className="font-semibold">
                  {status?.totals
                    ? status.totals.totalStaked.toFixed(2)
                    : '0.00'}{' '}
                  BOOP
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Unclaimed rewards</span>
                <span className="font-semibold">
                  {status?.totals
                    ? status.totals.totalUnclaimed.toFixed(6)
                    : '0.000000'}{' '}
                  BOOP
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Max effective APR</span>
                <span className="font-semibold">
                  {status?.apr_components
                    ? status.apr_components.apr_final_max.toFixed(2)
                    : '0.00'}
                  %
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 pt-1">
                <span>Stakes</span>
                <span>{status?.stakes?.length ?? 0}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Boosts</span>
                <span>{status?.boosts?.length ?? 0}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>NFTs</span>
                <span>{status?.nfts?.length ?? 0}</span>
              </div>
            </div>

            {/* APR breakdown */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <h2 className="font-semibold text-slate-100">
                  APR breakdown
                </h2>
                <span className="text-[11px] text-slate-400">
                  Max APR:{' '}
                  {status?.apr_components
                    ? status.apr_components.apr_final_max.toFixed(2)
                    : '0.00'}
                  %
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3">
                  <p className="text-[11px] text-slate-400">Streak</p>
                  <p className="text-sm font-semibold">
                    +
                    {status?.apr_components
                      ? status.apr_components.apr_streak.toFixed(2)
                      : '0.00'}
                    %
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    +2% per day, up to +40%
                  </p>
                </div>

                <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3">
                  <p className="text-[11px] text-slate-400">Level</p>
                  <p className="text-sm font-semibold">
                    +
                    {status?.apr_components
                      ? status.apr_components.apr_level.toFixed(2)
                      : '0.00'}
                    %
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    +0.5% per level, up to +10%
                  </p>
                </div>

                <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3">
                  <p className="text-[11px] text-slate-400">Boosts</p>
                  <p className="text-sm font-semibold">
                    +
                    {status?.apr_components
                      ? status.apr_components.apr_boost.toFixed(2)
                      : '0.00'}
                    %
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Temporary boosts you buy.
                  </p>
                </div>

                <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3">
                  <p className="text-[11px] text-slate-400">NFTs</p>
                  <p className="text-sm font-semibold">
                    +
                    {status?.apr_components
                      ? status.apr_components.apr_nft.toFixed(2)
                      : '0.00'}
                    %
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Permanent APR from NFTs.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {loadingText && (
          <p className="text-center text-xs text-slate-500">{loadingText}</p>
        )}
      </div>
    </div>
  )
}
