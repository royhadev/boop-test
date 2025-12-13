// app/boop/mini/withdraw/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

type StatusResponse = {
  totals?: { total_staked: number }
  apr?: { total: number }
  error?: string
}

function Tabs({ fid }: { fid: number | null }) {
  const q = fid ? `?fid=${fid}` : ''
  return (
    <div className="mb-4 flex gap-4 text-sm">
      <Link className="text-white/70 hover:text-white" href={`/boop/mini${q}`}>
        Home
      </Link>
      <Link className="text-white/70 hover:text-white" href={`/boop/mini/stake${q}`}>
        Stake
      </Link>
      <Link className="text-yellow-300" href={`/boop/mini/withdraw${q}`}>
        Withdraw
      </Link>
      <Link className="text-white/70 hover:text-white" href={`/boop/mini/leaderboard${q}`}>
        Leaderboard
      </Link>
    </div>
  )
}

export default function MiniWithdrawPage() {
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
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => setMounted(true), [])

  async function load() {
    if (!fid) return
    setErr(null)
    try {
      const resp = await fetch(`/api/user/status?fid=${fid}`, { cache: 'no-store' })
      const json = (await resp.json().catch(() => ({}))) as StatusResponse
      if (!resp.ok) throw new Error(json?.error || 'Failed to load status')
      setStatus(json)
    } catch (e: any) {
      setErr(e?.message || 'Failed')
    }
  }

  useEffect(() => {
    if (!mounted) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, fid])

  async function withdrawRewards() {
    if (!fid) return
    setLoading(true)
    setErr(null)
    setMsg(null)
    try {
      const resp = await fetch('/api/reward/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid }),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(json?.error || 'Withdraw failed')
      setMsg('Withdraw request sent.')
      await load()
    } catch (e: any) {
      setErr(e?.message || 'Withdraw failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <Tabs fid={fid} />

      <div className="text-2xl font-semibold">Withdraw rewards</div>
      <div className="mt-1 text-sm text-white/60">This page is stable (no JSON.parse crash). Rewards endpoint can be wired later.</div>

      {err ? <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">{err}</div> : null}
      {msg ? <div className="mt-3 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm">{msg}</div> : null}

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="text-xs text-white/60">Your status</div>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <div className="text-sm text-white/60">Total staked</div>
            <div className="text-lg font-semibold">{status?.totals?.total_staked != null ? `${Math.round(status.totals.total_staked).toLocaleString()} BOOP` : '—'}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-white/60">APR</div>
            <div className="text-lg font-semibold">{status?.apr?.total != null ? `${Math.round(status.apr.total)}%` : '—'}</div>
          </div>
        </div>
      </div>

      <button
        onClick={withdrawRewards}
        disabled={loading || !fid}
        className="mt-4 w-full rounded-xl bg-yellow-300 px-4 py-3 font-semibold text-black disabled:opacity-60"
      >
        {loading ? 'Withdrawing…' : 'Withdraw rewards'}
      </button>
    </div>
  )
}
