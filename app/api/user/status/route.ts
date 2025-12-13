import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calcApr } from "@/lib/rewardEngine";

function num(x: any, d = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : d;
}

function nowTs() {
  return Date.now();
}

function boostWindow(row: any) {
  const s = row?.started_at ?? row?.starts_at ?? null;
  const e = row?.ends_at ?? row?.expires_at ?? null;
  return { s, e };
}

function isBoostActive(row: any): boolean {
  const { s, e } = boostWindow(row);
  if (!s || !e) return false;
  const st = new Date(s).getTime();
  const en = new Date(e).getTime();
  const t = nowTs();
  return Number.isFinite(st) && Number.isFinite(en) && t >= st && t <= en;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fid = num(searchParams.get("fid"), 0);
    if (!fid) {
      return NextResponse.json({ error: "Invalid fid" }, { status: 400 });
    }

    // 1️⃣ user
    const { data: user, error: userErr } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("fid", fid)
      .maybeSingle();

    if (userErr || !user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // 2️⃣ stakes
    const { data: stakes } = await supabaseAdmin
      .from("stakes")
      .select("*")
      .eq("fid", fid);

    let totalStaked = 0;
    for (const s of stakes ?? []) {
      const amt =
        num(s.amount, NaN) ??
        num(s.staked_amount, NaN) ??
        num(s.value, 0);

      const status = (s.status ?? "").toString().toUpperCase();
      if (["UNSTAKED", "WITHDRAWN", "CANCELLED"].includes(status)) continue;

      totalStaked += amt;
    }

    // 3️⃣ boosts (REAL sync)
    let boostActive = false;
    let activeBoosts: any[] = [];

    const { data: boosts } = await supabaseAdmin
      .from("user_boosts")
      .select("*")
      .eq("user_id", user.id);

    if (boosts && boosts.length > 0) {
      activeBoosts = boosts
        .filter(isBoostActive)
        .map((b) => ({
          kind: b.kind ?? b.type ?? b.boost_type ?? "UNKNOWN",
          started_at: b.started_at,
          ends_at: b.ends_at,
        }));

      boostActive = activeBoosts.length > 0;
    }

    // 4️⃣ NFT (safe)
    const { data: nfts } = await supabaseAdmin
      .from("nft_ownership")
      .select("*")
      .eq("fid", fid);

    const hasNft = Array.isArray(nfts) && nfts.length > 0;

    // 5️⃣ APR
    const apr = calcApr({
      totalStaked,
      hasNft,
      boostActive,
      level: num(user.level, 0),
      dailyStreak: num(user.daily_streak, 0),
    });

    return NextResponse.json({
      ok: true,
      fid,
      user: {
        fid,
        username: user.username,
        pfp: user.pfp ?? null,
        xp: num(user.xp, 0),
        level: num(user.level, 0),
        daily_streak: num(user.daily_streak, 0),
      },
      staking: {
        totalStaked,
      },
      boosts: {
        active: boostActive,
        activeBoosts,
      },
      nft: {
        hasNft,
      },
      apr,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Unexpected error", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
