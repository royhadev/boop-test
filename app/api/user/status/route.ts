// app/api/user/status/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calcApr, calcScore } from "@/lib/rewardEngine";

function toNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fid = toNum(searchParams.get("fid"), 0);
    if (!fid) return NextResponse.json({ error: "Missing fid" }, { status: 400 });

    const { data: user, error: ue } = await supabaseAdmin
      .from("users")
      .select("id,fid,username,pfp,xp,level,daily_streak,withdrawable_rewards")
      .eq("fid", fid)
      .single();

    if (ue || !user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { data: stakes, error: se } = await supabaseAdmin
      .from("stakes")
      .select("staked_amount,status")
      .eq("user_id", user.id);

    if (se) return NextResponse.json({ error: "Failed to load stakes" }, { status: 500 });

    const activeStaked = (stakes || [])
      .filter((s: any) => String(s.status || "").toLowerCase() === "active")
      .reduce((sum: number, s: any) => sum + toNum(s.staked_amount, 0), 0);

    const { data: nftRow } = await supabaseAdmin
      .from("nft_ownership")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    const hasNft = !!nftRow;

    let boostActive = false;
    try {
      const { data: boosts } = await supabaseAdmin
        .from("user_boosts")
        .select("id,active,ends_at")
        .eq("user_id", user.id);

      const now = Date.now();
      boostActive = (boosts || []).some((b: any) => {
        const a = b?.active === true;
        const end = b?.ends_at ? new Date(b.ends_at).getTime() : 0;
        return a && (!end || end > now);
      });
    } catch {
      boostActive = false;
    }

    const apr = calcApr({
      totalStaked: activeStaked,
      hasNft,
      boostActive,
      level: toNum(user.level, 1),
      dailyStreak: toNum(user.daily_streak, 0),
    });

    const xp = toNum(user.xp, 0);
    const score = calcScore({ xp, totalStaked: activeStaked });

    return NextResponse.json({
      ok: true,
      fid,
      user: {
        fid: user.fid,
        username: user.username,
        pfp: user.pfp,
        xp,
        level: toNum(user.level, 1),
        daily_streak: toNum(user.daily_streak, 0),
        score,
        withdrawableRewards: toNum(user.withdrawable_rewards, 0),
      },
      staking: { totalStaked: activeStaked },
      nft: { hasNft },
      boosts: { active: boostActive },
      apr: {
        totalApr: apr.totalApr,
        components: apr.components,
        raw: apr.raw,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
