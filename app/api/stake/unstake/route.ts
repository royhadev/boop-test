import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { fid, stakeId } = body as { fid?: number; stakeId?: string }

    // ورودی ناقص → ولی در حالت dev همون 200 می‌دیم
    if (!fid || !stakeId) {
      return NextResponse.json({
        success: false,
        error: 'Missing fid or stakeId',
      })
    }

    // 1) پیدا کردن کاربر بر اساس fid
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('fid', fid)
      .single()

    if (userError || !user) {
      console.error('User not found for fid', fid, userError)
      return NextResponse.json({
        success: false,
        error: 'User not found for this fid',
      })
    }

    // 2) پیدا کردن stake مخصوص این کاربر
    const { data: stake, error: stakeError } = await supabase
      .from('stakes')
      .select('id, status, unlock_at, user_id')
      .eq('id', stakeId)
      .eq('user_id', user.id)
      .single()

    if (stakeError || !stake) {
      console.error('Stake not found for stakeId/user', stakeError)
      return NextResponse.json({
        success: false,
        error: 'Stake not found for this user',
      })
    }

    // 3) محاسبه unlock_at = الان + 21 روز
    const unlockAt = new Date(
      Date.now() + 21 * 24 * 60 * 60 * 1000
    ).toISOString()

    // 4) آپدیت وضعیت stake به pending_unstake
    const { error: updateError } = await supabase
      .from('stakes')
      .update({
        status: 'pending_unstake',
        unlock_at: unlockAt,
      })
      .eq('id', stakeId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Failed to update stake status', updateError)
      return NextResponse.json({
        success: false,
        error: 'Failed to update stake status',
      })
    }

    // ✅ در حالت dev همیشه status=200 می‌دیم
    return NextResponse.json({
      success: true,
      stakeId,
      new_status: 'pending_unstake',
      unlock_at: unlockAt,
    })
  } catch (err) {
    console.error('Unexpected error while requesting unstake', err)
    return NextResponse.json({
      success: false,
      error: 'Unexpected error while requesting unstake',
    })
  }
}
