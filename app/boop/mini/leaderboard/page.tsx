'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { UserBadges } from '../components/UserBadges'

type LeaderboardUser = {
  rank: number
  fid: number
  username: string | null
  pfp: string | null
  xp: number
  level: number
  daily_streak: number
  total_staked: number
  badges?: string[]
}

type LeaderboardResponse = {
  users?: LeaderboardUser[]
  error?: string
}

export default function LeaderboardPage() {
  const searchParams = useSearchParams()
  const rawFid = searchParams.get('fid')
  const currentFid = rawFid ? Number(rawFid) : null

  const [users, setUsers] = useState<LeaderboardUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch('/api/leaderboard')
        const json: LeaderboardResponse = await res.json()

        if (!res.ok || json.error) {
          throw new Error(json.error || 'Failed to fetch leaderboard')
        }

        if (!cancelled) {
          setUsers(json.users || [])
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Failed to fetch leaderboard')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const myUser =
    currentFid != null ? users.find((u) => u.fid === currentFid) : undefined

  return (
    <div className="h-full w-full px-4 py-3 text-slate-100">
      <div className="mx-auto flex h-full max-w-sm flex-col gap-3">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
            BOOP · Leaders
          </span>
          <h1 className="text-xl font-bold text-yellow-300">Leaderboard</h1>
          <p className="text-[11px] leading-snug text-slate-300">
            Top users ranked by <span className="font-medium">Level</span>,{' '}
            <span className="font-medium">XP</span>,{' '}
            <span className="font-medium">Streak</span> and later{' '}
            <span className="font-medium">Stake</span>.
          </p>
        </div>

        {/* My status card */}
        {currentFid && (
          <div className="rounded-3xl border border-slate-800 bg-black/70 p-3">
            <p className="text-[11px] font-semibold text-slate-200 mb-1">
              Your status
            </p>
            {myUser ? (
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-yellow-400 text-[11px] font-bold text-black shadow-[0_3px_0_rgba(0,0,0,0.5)]">
                  #{myUser.rank}
                </div>
                <div className="relative h-8 w-8 overflow-hidden rounded-full border border-slate-700 bg-slate-900">
                  <Image
                    src={myUser.pfp || '/boop-default-avatar.png'}
                    alt={myUser.username || `User ${myUser.fid}`}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-100">
                    {myUser.username
                      ? `@${myUser.username}`
                      : `User ${myUser.fid}`}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Level {myUser.level} • {myUser.xp} XP • Streak{' '}
                    {myUser.daily_streak} days
                  </p>
                  <UserBadges badges={getUserBadges(myUser)} size="sm" />
                </div>
                <div className="text-right text-[10px] text-slate-300">
                  <p>
                    Stake:{' '}
                    <span className="font-semibold text-yellow-300">
                      {formatCompactNumber(myUser.total_staked)} BOOP
                    </span>
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-slate-400">
                You are not in the current top leaderboard yet. Keep claiming
                daily and staking BOOP to appear here.
              </p>
            )}
          </div>
        )}

        {/* Main leaderboard card */}
        <div className="flex-1 rounded-3xl border border-slate-800 bg-[#020617]/95 p-3 shadow-[0_0_30px_rgba(15,23,42,0.9)]">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">
              Global leaderboard
            </span>
            <span className="text-[10px] text-slate-400">
              Updated in realtime
            </span>
          </div>

          {loading && (
            <div className="flex h-40 items-center justify-center rounded-2xl border border-slate-700 bg-black/40 text-xs text-slate-300">
              Loading top BOOP grinders...
            </div>
          )}

          {error && !loading && (
            <div className="rounded-2xl border border-red-400/70 bg-red-900/40 p-3 text-xs text-red-100">
              <div className="mb-1 font-semibold">Failed to load leaderboard</div>
              <div className="text-[11px] opacity-80">{error}</div>
            </div>
          )}

          {!loading && !error && users.length === 0 && (
            <div className="flex h-40 flex-col items-center justify-center rounded-2xl border border-slate-700 bg-black/40 text-xs text-slate-300">
              <span>No users on the leaderboard yet.</span>
              <span className="mt-1 text-[10px] text-slate-500">
                Start staking and claiming daily to appear here.
              </span>
            </div>
          )}

          {!loading && !error && users.length > 0 && (
            <div className="max-h-[380px] space-y-2 overflow-y-auto pb-1">
              {users.map((user) => (
                <div
                  key={user.fid}
                  className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-black/60 px-2 py-2"
                >
                  {/* Rank */}
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-black shadow-[0_3px_0_rgba(0,0,0,0.6)]">
                    {user.rank}
                  </div>

                  {/* Avatar + name + badges */}
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <div className="relative h-8 w-8 overflow-hidden rounded-full border border-slate-700 bg-slate-900">
                        <Image
                          src={user.pfp || '/boop-default-avatar.png'}
                          alt={user.username || `User ${user.fid}`}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-slate-100">
                          {user.username ? `@${user.username}` : `User ${user.fid}`}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Level {user.level} • {user.xp} XP
                        </span>
                      </div>
                    </div>

                    <UserBadges badges={getUserBadges(user)} size="sm" />
                  </div>

                  {/* Stats راست */}
                  <div className="flex flex-col items-end text-[10px] text-slate-300">
                    <span>
                      Stake:{' '}
                      <span className="font-semibold text-yellow-300">
                        {formatCompactNumber(user.total_staked)} BOOP
                      </span>
                    </span>
                    <span className="mt-0.5 text-slate-400">
                      Streak:{' '}
                      <span className="font-semibold text-slate-100">
                        {user.daily_streak} days
                      </span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mb-1 rounded-2xl border border-slate-800 bg-black/70 p-3">
          <h2 className="mb-1 text-[11px] font-semibold text-slate-200">
            How leaderboard works
          </h2>
          <ul className="space-y-1 text-[10px] text-slate-400">
            <li>• Users are ranked by Level → XP → Streak (and later Stake).</li>
            <li>• Streak is your consecutive daily claim streak (days).</li>
            <li>• Badges show Streak / Boost / NFT / Superboost status.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

/** اگر بک‌اند badges نفرستاد، بر اساس وضعیت کاربر یه حدس می‌زنیم */
function getUserBadges(u: LeaderboardUser): string[] {
  if (u.badges && u.badges.length > 0) return u.badges

  const res: string[] = []
  if (u.daily_streak >= 30) res.push('STREAK_30_DAYS')
  if (u.total_staked >= 3_500_000) res.push('NFT_HOLDER')
  if (u.total_staked >= 3_000_000) res.push('SUPERBOOST')
  if (u.total_staked > 0 && u.level >= 2) res.push('BOOST_FAN')
  return res
}

function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (value >= 1_000_000_000) {
    return (value / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B'
  }
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  }
  if (value >= 1_000) {
    return (value / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  }
  return value.toFixed(0)
}
