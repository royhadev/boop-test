import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

type UserRow = {
  id: string
  fid: number
  username: string
  xp: number
  level: number
  daily_streak: number
  last_daily_claim: string | null
}

type BoostConfig = {
  type: string
  aprBoost: number
  durationDays: number
}

// Predefined boost types
const BOOSTS: Record<string, BoostConfig> = {
  small_3d: {
    type: 'small_3d',
    aprBoost: 10,
    durationDays: 3
  },
  weekly_7d: {
    type: 'weekly_7d',
    aprBoost: 15,
    durationDays: 7
  },
  mega_14d: {
    type: 'mega_14d',
    aprBoost: 25,
    durationDays: 14
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)

    if (!body || typeof body.fid === 'undefined' || typeof body.boostType === 'undefined') {
      return NextResponse.json(
        { error: 'fid and boostType are required' },
        { status: 400 }
      )
    }

    const fid = Number(body.fid)
    const boostType = String(body.boostType)

    if (!fid || isNaN(fid)) {
      return NextResponse.json(
        { error: 'Invalid fid' },
        { status: 400 }
      )
    }

    const config = BOOSTS[boostType]
    if (!config) {
      return NextResponse.json(
        { error: 'Invalid boostType. Use one of: small_3d, weekly_7d, mega_14d' },
        { status: 400 }
      )
    }

    // Find user by fid
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('fid', fid)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found for this fid' },
        { status: 404 }
      )
    }

    const now = new Date()
    const expiresAt = new Date(
      now.getTime() + config.durationDays * 24 * 60 * 60 * 1000
    )

    // (Optional) You can choose to deactivate all expired boosts now
    await supabaseAdmin
      .from('user_boosts')
      .update({ is_active: false })
      .lt('expires_at', now.toISOString())

    // Insert new active boost
    const { data: boost, error: boostError } = await supabaseAdmin
      .from('user_boosts')
      .insert({
        user_id: user.id,
        boost_type: config.type,
        apr_boost: config.aprBoost,
        started_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        is_active: true
      })
      .select('*')
      .single()

    if (boostError || !boost) {
      console.error('boostError', boostError)
      return NextResponse.json(
        { error: 'Failed to create boost' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        message: 'Boost purchased successfully',
        boost
      },
      { status: 200 }
    )
  } catch (err) {
    console.error('boost/buy error', err)
    return NextResponse.json(
      { error: 'Internal server error in boost/buy' },
      { status: 500 }
    )
  }
}
