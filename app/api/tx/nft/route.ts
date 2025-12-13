import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { encodeFunctionData, isAddress } from 'viem'

// ---------------- Config ----------------

// بعداً این را در .env.local ست می‌کنی:
// NFT_CONTRACT_ADDRESS=0x1234....
const NFT_CONTRACT_ADDRESS = process.env.NFT_CONTRACT_ADDRESS

// شرط حداقل استیک برای فعال شدن / خرید NFT
const MIN_STAKE_FOR_NFT = 5_000_000 // 5M BOOP

// سقف فروش NFT در هر ماه (تقویم میلادی)
// ❗ اگر در یک ماه ۱۰۰ تا فروش نرود، ماه بعد دوباره فقط ۱۰۰ تا حق فروش داریم.
const MAX_NFT_PER_MONTH = 100

// ABI مینیمال فقط برای تابع mint(address to)
const nftAbi = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }],
    outputs: [],
  },
] as const

type UserRow = {
  id: string
  fid: number
}

// برای سادگی فقط استیک‌های active را می‌خواهیم
type StakeRow = {
  id: string
  user_id: string
  staked_amount: number
  status: string
}

export async function POST(req: Request) {
  try {
    if (!NFT_CONTRACT_ADDRESS) {
      return NextResponse.json(
        { error: 'NFT_CONTRACT_ADDRESS is not configured on server' },
        { status: 500 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const fid = Number(body?.fid || 0)
    const walletAddress = String(body?.walletAddress || '')

    if (!fid) {
      return NextResponse.json({ error: 'Missing fid' }, { status: 400 })
    }

    if (!walletAddress || !isAddress(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid or missing walletAddress' },
        { status: 400 }
      )
    }

    // 1) یوزر را از روی fid پیدا کن
    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('id, fid')
      .eq('fid', fid)
      .single<UserRow>()

    if (userErr || !user) {
      return NextResponse.json(
        { error: 'User not found for this fid' },
        { status: 404 }
      )
    }

    // 2) چک اینکه آیا قبلاً NFT فعال دارد یا نه
    const { data: nftRows, error: nftErr } = await supabaseAdmin
      .from('nft_ownership')
      .select('id, user_id, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (nftErr) {
      console.warn('Failed to check nft_ownership in /api/tx/nft:', nftErr)
    }

    if (nftRows && nftRows.length > 0) {
      return NextResponse.json(
        { error: 'User already has an active NFT boost' },
        { status: 400 }
      )
    }

    // 3) جمع استیک‌های active برای شرط 5M
    const { data: stakesRaw, error: stakesErr } = await supabaseAdmin
      .from('stakes')
      .select('id, user_id, staked_amount, status')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (stakesErr) {
      console.error('Failed to load stakes in /api/tx/nft:', stakesErr)
      return NextResponse.json(
        { error: 'Failed to load stakes' },
        { status: 500 }
      )
    }

    const stakes = (stakesRaw || []) as StakeRow[]
    const totalStakedActive = stakes.reduce(
      (sum, s) => sum + (s.staked_amount || 0),
      0
    )

    if (totalStakedActive < MIN_STAKE_FOR_NFT) {
      return NextResponse.json(
        {
          error: 'Not enough active stake for NFT',
          required_min: MIN_STAKE_FOR_NFT,
          totalStakedActive,
        },
        { status: 400 }
      )
    }

    // 4) چک سقف ۱۰۰ NFT در ماه (بدون carry-over)
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const monthEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
    )

    const { count: monthlyCount, error: monthlyErr } = await supabaseAdmin
      .from('nft_ownership')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart.toISOString())
      .lt('created_at', monthEnd.toISOString())

    if (monthlyErr) {
      console.error('Failed to count monthly NFTs in /api/tx/nft:', monthlyErr)
      return NextResponse.json(
        { error: 'Failed to check monthly NFT limit' },
        { status: 500 }
      )
    }

    const mintedThisMonth = (monthlyCount ?? 0) as number

    if (mintedThisMonth >= MAX_NFT_PER_MONTH) {
      return NextResponse.json(
        {
          error: 'Monthly NFT limit reached',
          monthly_limit: MAX_NFT_PER_MONTH,
          minted_this_month: mintedThisMonth,
        },
        { status: 400 }
      )
    }

    // 5) ساخت calldata برای تابع mint(address to)
    const data = encodeFunctionData({
      abi: nftAbi,
      functionName: 'mint',
      args: [walletAddress as `0x${string}`],
    })

    // 6) ساخت شیء تراکنش (بدون value چون پرداخت با توکن BOOP و approve جداست)
    const tx = {
      to: NFT_CONTRACT_ADDRESS,
      data,
      value: '0x0',
    }

    // (اختیاری) لاگ سبک در api_logs
    try {
      await supabaseAdmin.from('api_logs').insert({
        user_id: user.id,
        endpoint: '/api/tx/nft',
      })
    } catch (logErr) {
      console.warn('Failed to log /api/tx/nft:', logErr)
    }

    return NextResponse.json(
      {
        success: true,
        tx,
      },
      { status: 200 }
    )
  } catch (err) {
    console.error('[/api/tx/nft] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Server error in /api/tx/nft' },
      { status: 500 }
    )
  }
}
