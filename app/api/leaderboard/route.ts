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
    // ✅ cache 45s
    const cacheKey = `leaderboard:${req.url}`;
    const cached = getCache<any>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const { searchParams } = new URL(req.url);

    const page = Math.max(1, n(searchParams.get("page"), 1));
    const limit = Math.min(100, Math.max(1, n(searchParams.get("limit"), 50)));
    const onlyStakers = searchParams.get("onlyStakers") === "1";
    const fidParam = n(searchParams.get("fid"), 0);

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

    // aggregate stake per fid
    const stakeMap = new Map<number, number>();
    for (const s of stakes) {
      const fid = n(s.fid, 0);
      if (!fid) continue;

      const amt =
        n(s.amount, NaN) ??
        n(s.staked_amount, NaN) ??
        n(s.value, 0);

      const status = (s.status ?? "").toString().toUpperCase();
      if (["UNSTAKED", "WITHDRAWN", "CANCELLED"].includes(status)) continue;

      stakeMap.set(fid, (stakeMap.get(fid) ?? 0) + amt);
    }

    // rows
    let rows = users.map((u: any) => {
      const fid = u.fid;
      const totalStaked = stakeMap.get(fid) ?? 0;
      const xp = n(u.xp, 0);

      return {
        fid,
        username: u.username ?? `fid:${fid}`,
        pfp: u.pfp ?? null,
        xp,
        level: n(u.level, 0),
        daily_streak: n(u.daily_streak, 0),
        totalStaked,
        score: computeScore(xp, totalStaked),

        // ✅ UX flags (filled after sort)
        rank: null as number | null,
        isMe: fidParam ? fid === fidParam : false,
        isTop10: false,
        isStaker: totalStaked > 0,
      };
    });

    if (onlyStakers) rows = rows.filter(r => r.totalStaked > 0);

    // sort
    rows.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.xp - a.xp;
    });

    // fill ranks + top10
    for (let i = 0; i < rows.length; i++) {
      rows[i].rank = i + 1;
      rows[i].isTop10 = rows[i].rank <= 10;
    }

    // myRank
    let myRank: number | null = null;
    if (fidParam) {
      const mine = rows.find(r => r.fid === fidParam);
      myRank = mine?.rank ?? null;
    }

    // pagination
    const total = rows.length;
    const start = (page - 1) * limit;
    const end = start + limit;
    const pageRows = rows.slice(start, end);

    const response = {
      ok: true,
      page,
      limit,
      total,
      hasMore: end < total,
      leaderboard: pageRows,
      myRank,
      formula: "score = xp + log10(totalStaked + 1) * 100",
    };

    setCache(cacheKey, response, 45_000);
    return NextResponse.json(response);
  } catch (e: any) {
    return NextResponse.json(
      { error: "Unexpected error", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
