import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { fid, username, pfp } = body

    if (!fid) {
      return NextResponse.json(
        { error: 'fid is required' },
        { status: 400 }
      )
    }

    const fidNumber = Number(fid)

    // چک کاربر
    const { data: existingUser, error: selectError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('fid', fidNumber)
      .maybeSingle()

    if (existingUser) {
      return NextResponse.json({ user: existingUser })
    }

    // ساخت کاربر جدید
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        fid: fidNumber,
        username,
        pfp
      })
      .select('*')
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ user: newUser })
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
