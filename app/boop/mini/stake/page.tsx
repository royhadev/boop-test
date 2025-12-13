// app/boop/mini/stake/page.tsx
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
      <Link className="text-yellow-300" href={`/boop/mini/stake${q}`}>
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

export default function MiniStakePage() {
  const sp = useSearchParams()
  const fid = useMemo(() => {
    const v = sp.get('fid')
    const n = v ? Number(v) : NaN
    return Number.isFinite(n) && n > 0 ? n : null
  }, [sp])

  const [mounted, setMounted] = useState(false)
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

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

  async function onStake() {
    if (!fid) return
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0) {
      setErr('Enter a valid amount')
      return
    }
    setLoading(true)
    setErr(null)
    try {
      const resp = await fetch('/api/stake/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid, amount: n }),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(json?.error || 'Stake failed')
      setAmount('')
      await load()
    } catch (e: any) {
      setErr(e?.message || 'Stake failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <Tabs fid={fid} />

      <div className="text-2xl font-semibold">Stake BOOP</div>
      <div className="mt-1 text-sm text-white/60">Lock BOOP to earn APR. Unstake anytime; position unlocks after a 21-day cooldown.</div>

      {err ? <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">{err}</div> : null}

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="text-xs text-white/60">Current</div>
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

      <div className="mt-4">
        <div className="text-sm text-white/60">Amount</div>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 10000"
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-white/20"
        />
        <button
          onClick={onStake}
          disabled={loading || !fid}
          className="mt-3 w-full rounded-xl bg-yellow-300 px-4 py-3 font-semibold text-black disabled:opacity-60"
        >
          {loading ? 'Staking…' : 'Stake'}
        </button>
      </div>
    </div>
  )
}
