// app/api/farcaster/init/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { fetchFarcasterUserByFid } from '@/lib/neynar'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)

    if (!body || typeof body.fid === 'undefined') {
      return NextResponse.json(
        { error: 'fid is required' },
        { status: 400 }
      )
    }

    const fid = Number(body.fid)
    if (!fid || Number.isNaN(fid)) {
      return NextResponse.json(
        { error: 'Invalid fid' },
        { status: 400 }
      )
    }

    // 1) fetch user from Neynar
    const fcUser = await fetchFarcasterUserByFid(fid)

    if (!fcUser) {
      return NextResponse.json(
        { error: 'Could not fetch Farcaster user from Neynar' },
        { status: 502 }
      )
    }

    const username =
      fcUser.username ||
      `user_${fid}`

    const pfp = fcUser.pfpUrl || ''

    // 2) check if user already exists in Supabase
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('fid', fid)
      .maybeSingle()

    if (existingError) {
      console.error('Error fetching user by fid', existingError)
      return NextResponse.json(
        { error: 'Database error while fetching user' },
        { status: 500 }
      )
    }

    let userRow

    if (!existing) {
      // create new user
      const { data: created, error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          fid,
          username,
          pfp,
          xp: 0,
          level: 1,
          daily_streak: 0,
        })
        .select('*')
        .single()

      if (insertError || !created) {
        console.error('Error inserting user', insertError)
        return NextResponse.json(
          { error: 'Failed to create user' },
          { status: 500 }
        )
      }

      userRow = created
    } else {
      // update username / pfp if changed
      const shouldUpdate =
        existing.username !== username || existing.pfp !== pfp

      if (shouldUpdate) {
        const { data: updated, error: updateError } = await supabaseAdmin
          .from('users')
          .update({
            username,
            pfp,
          })
          .eq('id', existing.id)
          .select('*')
          .single()

        if (updateError || !updated) {
          console.error('Error updating user', updateError)
          return NextResponse.json(
            { error: 'Failed to update user profile' },
            { status: 500 }
          )
        }

        userRow = updated
      } else {
        userRow = existing
      }
    }

    return NextResponse.json(
      {
        message: 'Farcaster user initialized successfully',
        user: userRow,
        farcaster_profile: fcUser,
      },
      { status: 200 }
    )
  } catch (err) {
    console.error('/api/farcaster/init error', err)
    return NextResponse.json(
      { error: 'Internal server error in /api/farcaster/init' },
      { status: 500 }
    )
  }
}
