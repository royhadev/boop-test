// app/api/reward/withdraw/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function toNum(v: any, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

const WITHDRAW_FEE_PCT = 0.01; // ✅ 1% withdraw fee

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const fid = Number(body?.fid || 0);
    if (!fid) return NextResponse.json({ ok: false, error: "Missing fid" }, { status: 400 });

    const { data: user, error: uErr } = await supabaseAdmin
      .from("users")
      .select("id, fid, withdrawable_rewards, withdrawable_balance")
      .eq("fid", fid)
      .single();

    if (uErr || !user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

    const gross = toNum(user.withdrawable_rewards, 0);
    if (gross <= 0) {
      return NextResponse.json({ ok: false, error: "Nothing to withdraw" }, { status: 400 });
    }

    const fee = gross * WITHDRAW_FEE_PCT;
    const net = Math.max(0, gross - fee);

    const oldBal = toNum(user.withdrawable_balance, 0);
    const newBal = oldBal + net;

    const { error: upErr } = await supabaseAdmin
      .from("users")
      .update({
        withdrawable_rewards: 0,
        withdrawable_balance: newBal,
      })
      .eq("id", user.id);

    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      fid,

      // ✅ برای سازگاری + شفافیت
      withdrawn_gross: gross,
      fee,
      withdrawn: net, // (net received)

      withdrawable_rewards: 0,
      withdrawable_balance: newBal,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Withdraw failed" }, { status: 500 });
  }
}
