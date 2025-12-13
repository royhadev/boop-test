// app/boop/mini/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

type StatusResponse = {
  success?: boolean
  user?: {
    fid: number
    username: string
    display_name: string
    pfp_url: string | null
    level: number
    xp_total: number
    daily_streak: number
    badges?: string[]
  }
  totals?: { total_staked: number }
  apr?: { total: number; components: { base: number; nft: number; boost: number; level: number; streak: number } }
  boost?: { active: boolean; type?: string; ends_at?: string }
  nft?: { has: boolean }
  error?: string
}

function Tabs({ fid }: { fid: number | null }) {
  const q = fid ? `?fid=${fid}` : ''
  return (
    <div className="mb-4 flex gap-4 text-sm">
      <Link className="text-yellow-300" href={`/boop/mini${q}`}>
        Home
      </Link>
      <Link className="text-white/70 hover:text-white" href={`/boop/mini/stake${q}`}>
        Stake
      </Link>
      <Link className="text-white/70 hover:text-white" href={`/boop/mini/withdraw${q}`}>
        Withdraw
      </Link>
      <Link className="text-white/70 hover:text-white" href={`/boop/mini/leaderboard${q}`}>
        Leaderboard
      </Link>
    </div>
  )
}

export default function MiniHomePage() {
  const sp = useSearchParams()
  const fid = useMemo(() => {
    const v = sp.get('fid')
    const n = v ? Number(v) : NaN
    return Number.isFinite(n) && n > 0 ? n : null
  }, [sp])

  const [mounted, setMounted] = useState(false)
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => setMounted(true), [])

  async function load() {
    if (!fid) return
    setLoading(true)
    setErr(null)
    try {
      const resp = await fetch(`/api/user/status?fid=${fid}`, { cache: 'no-store' })
      const json = (await resp.json().catch(() => ({}))) as StatusResponse
      if (!resp.ok) throw new Error(json?.error || 'Failed to load status')
      setStatus(json)
    } catch (e: any) {
      setErr(e?.message || 'Failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!mounted) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, fid])

  async function activate(type: string) {
    if (!fid) return
    try {
      const resp = await fetch('/api/boost/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid, type }),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(json?.error || 'Failed to activate')
      await load()
    } catch (e: any) {
      setErr(e?.message || 'Failed to activate')
    }
  }

  const apr = status?.apr?.total ?? null
  const c = status?.apr?.components

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <Tabs fid={fid} />

      <div className="mb-2 text-xl font-semibold">BOOP Mini</div>
      <div className="text-xs text-white/60">fid: {fid ?? '—'}</div>

      {err ? <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">{err}</div> : null}

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs text-white/60">APR (Total)</div>
            <div className="text-4xl font-bold">{apr == null ? '—' : `${Math.round(apr)}%`}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-white/60">Total staked</div>
            <div className="text-lg font-semibold">
              {status?.totals?.total_staked != null ? `${Math.round(status.totals.total_staked).toLocaleString()} BOOP` : '—'}
            </div>
          </div>
        </div>

        <div className="mt-4 text-sm text-white/70">
          <div>Base: {c ? `${Math.round(c.base)}%` : '—'}</div>
          <div>NFT: {c ? `${Math.round(c.nft)}%` : '—'}</div>
          <div>Boost: {c ? `${Math.round(c.boost)}%` : '—'}</div>
          <div>Level: {c ? `${Math.round(c.level)}%` : '—'}</div>
          <div>Streak: {c ? `${Math.round(c.streak)}%` : '—'}</div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="mb-2 text-sm font-semibold">Boost</div>
        <div className="text-xs text-white/60">
          Server-truth: after activation we re-fetch /api/user/status so Boost won&apos;t “disappear” on tab switch.
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => activate('boost24h')} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
            Boost 24h (+20%)
          </button>
          <button onClick={() => activate('boost72h')} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
            Boost 72h (+20%)
          </button>
          <button onClick={() => activate('boost7d')} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
            Boost 7d (+20%)
          </button>
          <button onClick={() => activate('superboost24h')} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
            SuperBoost 24h (+20%)
          </button>
        </div>

        {loading ? <div className="mt-3 text-xs text-white/50">Loading…</div> : null}
      </div>
    </div>
  )
}
