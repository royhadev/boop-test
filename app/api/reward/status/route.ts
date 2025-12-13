// app/api/reward/status/route.ts
// Compatibility endpoint (older UI called /api/reward/status).
// We forward to /api/user/status so UI won't "crash" if some page still uses it.
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const fid = url.searchParams.get('fid')
    const target = new URL(`/api/user/status?fid=${encodeURIComponent(fid || '')}`, url.origin)

    const resp = await fetch(target.toString(), { cache: 'no-store' })
    const json = await resp.json().catch(() => ({}))

    if (!resp.ok) {
      return NextResponse.json(json || { error: 'Failed' }, { status: resp.status })
    }

    // Add a reward block (safe default for now)
    return NextResponse.json({
      ...json,
      reward: {
        unclaimed: json?.reward?.unclaimed ?? 0,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
