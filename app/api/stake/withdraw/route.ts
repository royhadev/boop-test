import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const WITHDRAW_FEE_PCT = 0.01; // ✅ 1% withdraw fee

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const fid = Number(body?.fid);
    const stakeId = String(body?.stakeId || "");

    if (!fid || !stakeId) {
      return NextResponse.json(
        { ok: false, error: "Missing fid or stakeId" },
        { status: 400 }
      );
    }

    // 1) get user_id from fid
    const u = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("fid", fid)
      .maybeSingle();

    const userId = u.data?.id;
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "User not found" },
        { status: 404 }
      );
    }

    // 2) load stake
    const s = await supabaseAdmin
      .from("stakes")
      .select("id,status,unlock_at,staked_amount,user_id")
      .eq("id", stakeId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!s.data) {
      return NextResponse.json(
        { ok: false, error: "Stake not found" },
        { status: 404 }
      );
    }

    // ✅ فقط unlocked قابل برداشت است
    if (s.data.status !== "unlocked") {
      return NextResponse.json(
        { ok: false, error: "Stake is not unlocked yet" },
        { status: 400 }
      );
    }

    // safety check on unlock time
    const unlockAtMs = s.data.unlock_at
      ? new Date(s.data.unlock_at).getTime()
      : NaN;

    if (!Number.isFinite(unlockAtMs) || unlockAtMs > Date.now()) {
      return NextResponse.json(
        { ok: false, error: "Stake not unlocked yet" },
        { status: 400 }
      );
    }

    const gross = Number(s.data.staked_amount || 0);
    const fee = gross * WITHDRAW_FEE_PCT;
    const net = Math.max(0, gross - fee);

    // 3) delete stake (dev logic)
    const del = await supabaseAdmin
      .from("stakes")
      .delete()
      .eq("id", stakeId)
      .eq("user_id", userId);

    if (del.error) {
      return NextResponse.json(
        { ok: false, error: del.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      fid,
      stakeId,

      // ✅ v1 compatibility: "amount" مثل قبل = gross
      amount: gross,

      // ✅ new fields (v2 can use these)
      fee,
      net,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
