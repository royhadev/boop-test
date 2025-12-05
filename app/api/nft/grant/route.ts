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

type NftConfig = {
  type: string
  aprNft: number
  level: number
}

// Predefined NFT types
const NFTS: Record<string, NftConfig> = {
  stake_boost_L1: {
    type: 'stake_boost_L1',
    aprNft: 3,
    level: 1
  },
  stake_boost_L2: {
    type: 'stake_boost_L2',
    aprNft: 7,
    level: 2
  },
  stake_boost_L3: {
    type: 'stake_boost_L3',
    aprNft: 12,
    level: 3
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)

    if (!body || typeof body.fid === 'undefined' || typeof body.nftType === 'undefined') {
      return NextResponse.json(
        { error: 'fid and nftType are required' },
        { status: 400 }
      )
    }

    const fid = Number(body.fid)
    const nftType = String(body.nftType)

    if (!fid || isNaN(fid)) {
      return NextResponse.json(
        { error: 'Invalid fid' },
        { status: 400 }
      )
    }

    const config = NFTS[nftType]
    if (!config) {
      return NextResponse.json(
        { error: 'Invalid nftType. Use one of: stake_boost_L1, stake_boost_L2, stake_boost_L3' },
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

    // Insert new NFT for this user
    const { data: nft, error: nftError } = await supabaseAdmin
      .from('user_nfts')
      .insert({
        user_id: user.id,
        nft_type: config.type,
        apr_nft: config.aprNft,
        level: config.level,
        is_active: true
      })
      .select('*')
      .single()

    if (nftError || !nft) {
      console.error('nftError', nftError)
      return NextResponse.json(
        { error: 'Failed to grant NFT' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        message: 'NFT granted successfully',
        nft
      },
      { status: 200 }
    )
  } catch (err) {
    console.error('nft/grant error', err)
    return NextResponse.json(
      { error: 'Internal server error in nft/grant' },
      { status: 500 }
    )
  }
}
