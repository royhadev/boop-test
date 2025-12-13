import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCache, setCache } from "@/lib/simpleCache";

function n(x: any, d = 0) {
  const v = Number(x);
  return Number.isFinite(v) ? v : d;
}

function computeScore(xp: number, totalStaked: number) {
  const stake = Math.max(0, n(totalStaked, 0));
  const s = Math.log10(stake + 1) * 100;
  return Math.round((n(xp, 0) + s) * 100) / 100;
}

export async function GET(req: Request) {
  try {
    const cacheKey = `leaderboard:me:${req.url}`;
    const cached = getCache<any>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const { searchParams } = new URL(req.url);
    const fid = n(searchParams.get("fid"), 0);

    if (!fid) {
      return NextResponse.json({ error: "fid is required" }, { status: 400 });
    }

    // users
    const { data: users, error: uErr } = await supabaseAdmin
      .from("users")
      .select("*");

    if (uErr || !users) {
      return NextResponse.json(
        { error: uErr?.message ?? "Failed to load users" },
        { status: 500 }
      );
    }

    // stakes
    const { data: stakes, error: sErr } = await supabaseAdmin
      .from("stakes")
      .select("*");

    if (sErr || !stakes) {
      return NextResponse.json(
        { error: sErr?.message ?? "Failed to load stakes" },
        { status: 500 }
      );
    }

    // aggregate
    const stakeMap = new Map<number, number>();
    for (const s of stakes) {
      const f = n(s.fid, 0);
      if (!f) continue;

      const amt =
        n(s.amount, NaN) ??
        n(s.staked_amount, NaN) ??
        n(s.value, 0);

      const status = (s.status ?? "").toString().toUpperCase();
      if (["UNSTAKED", "WITHDRAWN", "CANCELLED"].includes(status)) continue;

      stakeMap.set(f, (stakeMap.get(f) ?? 0) + amt);
    }

    // rows
    const rows = users.map((u: any) => {
      const f = u.fid;
      const totalStaked = stakeMap.get(f) ?? 0;
      const xp = n(u.xp, 0);

      return {
        fid: f,
        username: u.username ?? `fid:${f}`,
        pfp: u.pfp ?? null,
        xp,
        level: n(u.level, 0),
        daily_streak: n(u.daily_streak, 0),
        totalStaked,
        score: computeScore(xp, totalStaked),

        // filled after sort:
        rank: 0,
        isTop10: false,
        isStaker: totalStaked > 0,
      };
    });

    // sort
    rows.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.xp - a.xp;
    });

    // fill global ranks
    for (let i = 0; i < rows.length; i++) {
      rows[i].rank = i + 1;
      rows[i].isTop10 = rows[i].rank <= 10;
    }

    const idx = rows.findIndex(r => r.fid === fid);
    if (idx < 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const me = { ...rows[idx], isMe: true };
    const neighbors = rows
      .slice(Math.max(0, idx - 2), Math.min(rows.length, idx + 3))
      .map(r => ({ ...r, isMe: r.fid === fid }));

    const response = {
      ok: true,
      fid,
      myRank: me.rank,
      myScore: me.score,
      me,
      neighbors,
      formula: "score = xp + log10(totalStaked + 1) * 100",
    };

    setCache(cacheKey, response, 30_000);
    return NextResponse.json(response);
  } catch (e: any) {
    return NextResponse.json(
      { error: "Unexpected error", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
