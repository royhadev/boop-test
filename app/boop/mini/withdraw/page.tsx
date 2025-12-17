'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

type StatusResponse = {
  user?: {
    withdrawableRewards?: number
  }
  error?: string
}

export default function MiniWithdrawPage() {
  const sp = useSearchParams()
  const fid = useMemo(() => {
    const v = sp.get('fid')
    const n = v ? Number(v) : NaN
    return Number.isFinite(n) && n > 0 ? n : null
  }, [sp])

  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function load() {
    if (!fid) return
    setErr(null)
    const r = await fetch(`/api/user/status?fid=${fid}`, { cache: 'no-store' })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j?.error || 'Failed')
    setStatus(j)
  }

  useEffect(() => { load() }, [fid])

  async function withdraw() {
    if (!fid) return
    setLoading(true)
    try {
      const r = await fetch('/api/reward/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || 'Withdraw failed')
      setMsg('Withdraw request sent')
      await load()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  const amount = status?.user?.withdrawableRewards ?? 0

  // ✅ فقط نمایش 3 رقم اعشار (بدون تغییر منطق)
  const displayAmount = Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-4 flex gap-4 text-sm">
        <Link className="text-white/70" href={`/boop/mini?fid=${fid}`}>Home</Link>
        <Link className="text-yellow-300" href="#">Withdraw</Link>
      </div>

      <h1 className="text-2xl font-semibold">Withdraw rewards</h1>

      <div className="mt-4 rounded-xl bg-black/20 p-4">
        <div className="text-sm text-white/60">Withdrawable</div>
        <div className="text-2xl font-bold">
          {displayAmount} BOOP
        </div>
      </div>

      {err && <div className="mt-3 text-red-400">{err}</div>}
      {msg && <div className="mt-3 text-green-400">{msg}</div>}

      <button
        onClick={withdraw}
        disabled={loading || amount <= 0}
        className="mt-4 w-full rounded-xl bg-yellow-300 px-4 py-3 font-semibold text-black disabled:opacity-50"
      >
        {loading ? 'Withdrawing…' : 'Withdraw'}
      </button>
    </div>
  )
}
