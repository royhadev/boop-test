import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: Request) {
  try {
    const { fid, stakeId } = await req.json()

    if (!fid || !stakeId) {
      return NextResponse.json({ error: 'Missing fid or stakeId' }, { status: 400 })
    }

    // 1) کاربر
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('*')
      .eq('fid', fid)
      .single()

    if (userErr || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 2) استیک موردنظر
    const { data: stake, error: stakeErr } = await supabase
      .from('stakes')
      .select('*')
      .eq('id', stakeId)
      .eq('user_id', user.id)
      .single()

    if (stakeErr || !stake) {
      return NextResponse.json({ error: 'Stake not found' }, { status: 404 })
    }

    if (stake.status !== 'unlocked') {
      return NextResponse.json(
        { error: 'Stake is not unlocked yet' },
        { status: 400 }
      )
    }

    // 3) مارک کردن به عنوان withdrawn در dev mode
    const { error: updateErr } = await supabase
      .from('stakes')
      .update({
        status: 'withdrawn',
        staked_amount: 0,
        unclaimed_reward: 0,
      })
      .eq('id', stakeId)

    if (updateErr) {
      console.error('Stake withdraw update error:', updateErr)
      return NextResponse.json({ error: 'Failed to update stake' }, { status: 500 })
    }

    // TODO: در نسخه‌ی نهایی، اینجا call قرارداد و transfer توکن‌های اصلی به والت انجام می‌شود

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Stake withdraw error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
