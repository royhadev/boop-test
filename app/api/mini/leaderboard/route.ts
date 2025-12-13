import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function uniq(a: string[]) {
  return Array.from(new Set(a));
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get("limit") || 50)));

    const { data: users, error: uErr } = await supabaseAdmin
      .from("users")
      .select("id,fid,username,pfp,xp,level,daily_streak")
      .order("level", { ascending: false })
      .order("xp", { ascending: false })
      .order("daily_streak", { ascending: false })
      .limit(limit);

    if (uErr) {
      console.error("leaderboard users error:", uErr);
      return NextResponse.json({ error: "Failed to fetch leaderboard users" }, { status: 500 });
    }

    const rows = users || [];
    if (rows.length === 0) return NextResponse.json({ users: [] });

    const userIds = rows.map((r: any) => r.id);

    // stakes sum (active)
    const { data: stakes, error: sErr } = await supabaseAdmin
      .from("stakes")
      .select("user_id,staked_amount,status")
      .in("user_id", userIds)
      .eq("status", "active");

    if (sErr) {
      console.error("leaderboard stakes error:", sErr);
      return NextResponse.json({ error: "Failed to fetch leaderboard stakes" }, { status: 500 });
    }

    const stakedMap = new Map<string, number>();
    for (const r of stakes || []) {
      const uid = String((r as any).user_id);
      const v = Number((r as any).staked_amount || 0);
      stakedMap.set(uid, (stakedMap.get(uid) || 0) + (Number.isFinite(v) ? v : 0));
    }

    // active boosts
    const nowIso = new Date().toISOString();
    const { data: boosts, error: bErr } = await supabaseAdmin
      .from("user_boosts")
      .select("user_id,boost_type,ends_at")
      .in("user_id", userIds)
      .gt("ends_at", nowIso);

    if (bErr) {
      console.error("leaderboard boosts error:", bErr);
      return NextResponse.json({ error: "Failed to fetch leaderboard boosts" }, { status: 500 });
    }

    const boostMap = new Map<string, string>(); // user_id -> boost_type
    for (const r of boosts || []) {
      const uid = String((r as any).user_id);
      // اگر چندتا برگشت، مهم‌ترین رو نگه می‌داریم (super اولویت)
      const t = String((r as any).boost_type || "");
      const prev = boostMap.get(uid);
      if (!prev) boostMap.set(uid, t);
      else {
        const pSuper = prev.toLowerCase().includes("super");
        const tSuper = t.toLowerCase().includes("super");
        if (!pSuper && tSuper) boostMap.set(uid, t);
      }
    }

    // active nfts
    const { data: nfts, error: nErr } = await supabaseAdmin
      .from("user_nfts")
      .select("user_id,is_active")
      .in("user_id", userIds)
      .eq("is_active", true);

    if (nErr) {
      console.error("leaderboard nfts error:", nErr);
      return NextResponse.json({ error: "Failed to fetch leaderboard nfts" }, { status: 500 });
    }

    const nftSet = new Set<string>((nfts || []).map((r: any) => String(r.user_id)));

    const leaderboard = rows.map((u: any, i: number) => {
      const uid = String(u.id);
      const badges: string[] = [];

      if (nftSet.has(uid)) badges.push("NFT");

      const bt = boostMap.get(uid) || null;
      if (bt) badges.push(bt.toLowerCase().includes("super") ? "SuperBoost" : "Boost");

      if ((u.daily_streak || 0) >= 30) badges.push("Streak");
      if ((u.level || 0) >= 20) badges.push("Level20");

      return {
        rank: i + 1,
        fid: u.fid,
        username: u.username,
        pfp: u.pfp,
        xp: u.xp ?? 0,
        level: u.level ?? 0,
        daily_streak: u.daily_streak ?? 0,
        total_staked: stakedMap.get(uid) || 0,
        badges: uniq(badges),
      };
    });

    return NextResponse.json({ users: leaderboard });
  } catch (e) {
    console.error("leaderboard unexpected error:", e);
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  }
}
