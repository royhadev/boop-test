import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

type UserRow = {
  id: string
  fid: number
}

type NftOwnershipRow = {
  id: string
  user_id: string
  is_active: boolean
  nft_tier?: string | null
}

// این route فعلاً ساده است و فقط در DB NFT را فعال می‌کند.
// در آینده می‌تونی اینجا txHash را روی RPC چک کنی که واقعاً success بوده.

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const fid = Number(body?.fid || 0)
    const txHash = String(body?.txHash || '').trim()

    if (!fid) {
      return NextResponse.json({ error: 'Missing fid' }, { status: 400 })
    }

    if (!txHash) {
      return NextResponse.json({ error: 'Missing txHash' }, { status: 400 })
    }

    // 1) پیدا کردن یوزر از روی fid
    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('id, fid')
      .eq('fid', fid)
      .single<UserRow>()

    if (userErr || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 2) چک اینکه آیا NFT فعال دیگری دارد یا نه
    const { data: existingNfts, error: nftErr } = await supabaseAdmin
      .from('nft_ownership')
      .select('id, user_id, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (nftErr) {
      console.warn('Failed to load nft_ownership in /api/tx/confirm:', nftErr)
    }

    if (existingNfts && existingNfts.length > 0) {
      return NextResponse.json(
        { error: 'User already has an active NFT' },
        { status: 400 }
      )
    }

    // 3) ساخت رکورد NFT جدید (tier را فعلاً "standard" می‌گذاریم)
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('nft_ownership')
      .insert({
        user_id: user.id,
        nft_tier: 1,
        is_active: true,
        // اگر ستون‌های دیگری مثل tx_hash، created_at و ... داری، می‌تونی اینجا اضافه کنی
      })
      .select('id, user_id, is_active, nft_tier')
      .single<NftOwnershipRow>()

    if (insertErr || !inserted) {
      console.error('Failed to insert nft_ownership in /api/tx/confirm:', insertErr)
      return NextResponse.json(
        { error: 'Failed to activate NFT for user' },
        { status: 500 }
      )
    }

    // 4) لاگ سبک
    try {
      await supabaseAdmin.from('api_logs').insert({
        user_id: user.id,
        endpoint: '/api/tx/confirm',
        extra: { txHash },
      })
    } catch (logErr) {
      console.warn('Failed to log /api/tx/confirm:', logErr)
    }

    return NextResponse.json(
      {
        success: true,
        message: 'NFT activated for user',
        nft: inserted,
      },
      { status: 200 }
    )
  } catch (err) {
    console.error('[/api/tx/confirm] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Server error in /api/tx/confirm' },
      { status: 500 }
    )
  }
}
