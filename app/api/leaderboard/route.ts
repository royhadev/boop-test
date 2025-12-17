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

function getMonthRangeUTC(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0));
  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    key: `${y}-${String(m + 1).padStart(2, "0")}`,
  };
}

type MonthlyMeta = { monthKey: string; startISO: string; endISO: string; fallback: boolean; source?: string };

async function loadMonthlyXpMap(
  startISO: string,
  endISO: string,
  fidToUserId: Map<number, string>
): Promise<{ map: Map<number, number>; meta: MonthlyMeta }> {
  const meta: MonthlyMeta = { monthKey: getMonthRangeUTC().key, startISO, endISO, fallback: false };

  // helper to sum numeric column from rows
  const sumFromRows = (rows: any[], fidGetter: (r: any) => number) => {
    const out = new Map<number, number>();
    for (const r of rows || []) {
      const fid = fidGetter(r);
      if (!fid) continue;

      // try common numeric fields in order
      const amt =
        (r.amount ?? r.xp ?? r.points ?? r.delta ?? r.value ?? r.change ?? 0);

      const add = n(amt, 0);
      out.set(fid, (out.get(fid) ?? 0) + add);
    }
    return out;
  };

  // We will try multiple query shapes.
  // If a select references a missing column, Supabase returns an error -> we catch and try next.
  const tries: Array<{
    name: string;
    table: string;
    select: string;
    fidGetter: (r: any) => number;
    where?: (q: any) => any;
  }> = [
    // 1) xp_logs with fid + amount
    {
      name: "xp_logs(fid,amount,created_at)",
      table: "xp_logs",
      select: "fid,amount,created_at",
      fidGetter: (r) => n(r.fid, 0),
    },
    // 2) xp_logs with fid + xp
    {
      name: "xp_logs(fid,xp,created_at)",
      table: "xp_logs",
      select: "fid,xp,created_at",
      fidGetter: (r) => n(r.fid, 0),
    },
    // 3) xp_logs with user_id + amount  (map user_id -> fid)
    {
      name: "xp_logs(user_id,amount,created_at)",
      table: "xp_logs",
      select: "user_id,amount,created_at",
      fidGetter: (r) => {
        const uid = String(r.user_id || "");
        // reverse lookup: user_id -> fid
        for (const [fid, id] of fidToUserId.entries()) if (id === uid) return fid;
        return 0;
      },
    },
    // 4) xp_logs with user_id + xp
    {
      name: "xp_logs(user_id,xp,created_at)",
      table: "xp_logs",
      select: "user_id,xp,created_at",
      fidGetter: (r) => {
        const uid = String(r.user_id || "");
        for (const [fid, id] of fidToUserId.entries()) if (id === uid) return fid;
        return 0;
      },
    },

    // 5) xp_logs table (you mentioned xp_logs exists)
    {
      name: "xp_logs(fid,amount,created_at)",
      table: "xp_logs",
      select: "fid,amount,created_at",
      fidGetter: (r) => n(r.fid, 0),
    },
    {
      name: "xp_logs(fid,xp,created_at)",
      table: "xp_logs",
      select: "fid,xp,created_at",
      fidGetter: (r) => n(r.fid, 0),
    },
    {
      name: "xp_logs(user_id,amount,created_at)",
      table: "xp_logs",
      select: "user_id,amount,created_at",
      fidGetter: (r) => {
        const uid = String(r.user_id || "");
        for (const [fid, id] of fidToUserId.entries()) if (id === uid) return fid;
        return 0;
      },
    },
    {
      name: "xp_logs(user_id,xp,created_at)",
      table: "xp_logs",
      select: "user_id,xp,created_at",
      fidGetter: (r) => {
        const uid = String(r.user_id || "");
        for (const [fid, id] of fidToUserId.entries()) if (id === uid) return fid;
        return 0;
      },
    },
  ];

  for (const t of tries) {
    try {
      const q = supabaseAdmin
        .from(t.table as any)
        .select(t.select)
        .gte("created_at", startISO)
        .lt("created_at", endISO)
        .limit(10000);

      const { data, error } = await q;
      if (error) throw new Error(error.message);

      const map = sumFromRows((data as any[]) || [], t.fidGetter);

      // If we got any rows, accept. (even if zero rows, might be valid—still accept)
      meta.source = t.name;
      return { map, meta };
    } catch {
      // try next
    }
  }

  meta.fallback = true;
  meta.source = "fallback(lifetime xp)";
  return { map: new Map<number, number>(), meta };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, n(searchParams.get("page"), 1));
    const limit = Math.min(100, Math.max(1, n(searchParams.get("limit"), 50)));
    const fidParam = n(searchParams.get("fid"), 0);

    const modeRaw = String(searchParams.get("mode") || "global").toLowerCase();
    const mode: "global" | "monthly" = modeRaw === "monthly" ? "monthly" : "global";

    const cacheKey = `leaderboard:${mode}:${req.url}`;
    const cached = getCache<any>(cacheKey);
    if (cached) return NextResponse.json(cached);

    // users
    const { data: users, error: uErr } = await supabaseAdmin
      .from("users")
      .select("id,fid,username,pfp,xp,level,daily_streak");

    if (uErr || !users) throw new Error("Failed to load users");

    // stakes (ACTIVE only)
    const { data: stakes, error: sErr } = await supabaseAdmin
      .from("stakes")
      .select("user_id,staked_amount,status");

    if (sErr || !stakes) throw new Error("Failed to load stakes");

    // stake by user_id
    const stakeMap = new Map<string, number>();
    for (const s of stakes as any[]) {
      if ((s.status ?? "").toLowerCase() !== "active") continue;
      const uid = String(s.user_id || "");
      const amt = n(s.staked_amount, 0);
      stakeMap.set(uid, (stakeMap.get(uid) ?? 0) + amt);
    }

    // fid -> user_id map (for logs that use user_id)
    const fidToUserId = new Map<number, string>();
    for (const u of users as any[]) {
      fidToUserId.set(n(u.fid, 0), String(u.id || ""));
    }

    // monthly xp map
    let monthlyXpMap = new Map<number, number>();
    let monthlyMeta: MonthlyMeta | null = null;

    if (mode === "monthly") {
      const { startISO, endISO, key } = getMonthRangeUTC();
      const loaded = await loadMonthlyXpMap(startISO, endISO, fidToUserId);
      monthlyXpMap = loaded.map;
      monthlyMeta = { ...loaded.meta, monthKey: key };
    }

    // rows
    let rows = (users as any[]).map((u: any) => {
      const totalStaked = stakeMap.get(String(u.id || "")) ?? 0;

      const xpLifetime = n(u.xp, 0);
      const xpMonthly = mode === "monthly" ? (monthlyXpMap.get(n(u.fid, 0)) ?? 0) : xpLifetime;
      const xpUsed = mode === "monthly" ? xpMonthly : xpLifetime;

      return {
        fid: u.fid,
        username: u.username ?? `fid:${u.fid}`,
        pfp: u.pfp ?? null,
        xp: xpUsed,
        level: n(u.level, 0),
        daily_streak: n(u.daily_streak, 0),
        totalStaked,
        score: computeScore(xpUsed, totalStaked),
        rank: null as number | null,
        isMe: fidParam ? u.fid === fidParam : false,
        isTop10: false,
        isStaker: totalStaked > 0,
      };
    });

    rows.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.xp - a.xp;
    });

    rows.forEach((r, i) => {
      r.rank = i + 1;
      r.isTop10 = r.rank <= 10;
    });

    const total = rows.length;
    const start = (page - 1) * limit;
    const pageRows = rows.slice(start, start + limit);

    const formula =
      mode === "monthly"
        ? "score = monthlyXP + log10(totalStaked + 1) * 100"
        : "score = xp + log10(totalStaked + 1) * 100";

    const response: any = {
      ok: true,
      mode,
      page,
      limit,
      total,
      hasMore: start + limit < total,
      leaderboard: pageRows,
      myRank: fidParam ? rows.find((r) => r.fid === fidParam)?.rank ?? null : null,
      formula,
    };

    if (mode === "monthly") {
      response.monthly = monthlyMeta; // includes source + fallback
    }

    setCache(cacheKey, response, 45_000);
    return NextResponse.json(response);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
