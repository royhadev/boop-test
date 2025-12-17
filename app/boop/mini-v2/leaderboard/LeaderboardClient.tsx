// app/boop/mini-v2/leaderboard/LeaderboardClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import BoopCard from "../components/BoopCard";
import GoldButton from "../components/GoldButton";

type LbRow = {
  fid: number;
  username: string;
  pfp: string | null;
  xp: number;
  level: number;
  daily_streak: number;
  totalStaked: number;
  score: number;
  rank: number;
  isMe?: boolean;
};

type LeaderboardResp = {
  ok: boolean;
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  leaderboard: LbRow[];
  myRank: number | null;
  formula?: string;
};

type MeResp = {
  ok: boolean;
  myRank: number | null;
  myScore: number | null;
};

type UserStatusResp = {
  ok: boolean;
  user: {
    fid: number;
    username: string;
    pfp?: string | null;
    xp: number;
    level: number;
    daily_streak: number;
    score?: number;
  };
};

const fmt = (n: number, d = 2) =>
  Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: d });

export default function LeaderboardClient({ fid }: { fid: string }) {
  const fidNum = useMemo(() => {
    const n = Number(fid);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [fid]);

  const [page, setPage] = useState(1);
  const [lb, setLb] = useState<LeaderboardResp | null>(null);
  const [me, setMe] = useState<MeResp | null>(null);
  const [meUser, setMeUser] = useState<UserStatusResp | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(p: number) {
    setLoading(true);
    try {
      const [rLb, rMe, rUser] = await Promise.all([
        fetch(`/api/leaderboard?page=${p}&limit=10`, { cache: "no-store" }),
        fidNum ? fetch(`/api/leaderboard/me?fid=${fidNum}`, { cache: "no-store" }) : null,
        fidNum ? fetch(`/api/user/status?fid=${fidNum}`, { cache: "no-store" }) : null,
      ]);

      const jLb = await rLb.json();
      if (jLb?.ok) setLb(jLb);

      if (rMe) {
        const jMe = await rMe.json();
        if (jMe?.ok) setMe(jMe);
      } else {
        setMe(null);
      }

      if (rUser) {
        const jUser = await rUser.json();
        if (jUser?.ok) setMeUser(jUser);
      } else {
        setMeUser(null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(page);
    // refresh every 20s
    const t = setInterval(() => load(page), 20_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, fidNum]);

  const rows = lb?.leaderboard || [];
  const formula = lb?.formula || "score = xp + log10(totalStaked + 1) * 100";

  const myRank = me?.myRank ?? null;
  const myScore = me?.myScore ?? null;

  const myName = meUser?.user?.username || (fidNum ? `fid_${fidNum}` : "Guest");
  const myPfp = meUser?.user?.pfp || "/brand/boop-app-logo.png";
  const myXp = meUser?.user?.xp ?? 0;
  const myLevel = meUser?.user?.level ?? 0;
  const myStreak = meUser?.user?.daily_streak ?? 0;

  return (
    <div className="space-y-4">
      {/* My Rank */}
      <BoopCard title="My Rank" subtitle="Your score and rank">
        {!fidNum ? (
          <div className="text-sm text-white/60">Missing fid in URL.</div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={myPfp}
                className="w-10 h-10 rounded-2xl border border-white/10"
                alt="pfp"
              />
              <div className="min-w-0">
                <div className="font-semibold truncate">{myName}</div>
                <div className="text-[12px] text-white/60">
                  XP {fmt(myXp, 0)} • Level {myLevel} • Streak {myStreak}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[12px] text-white/60">Rank</div>
              <div className="text-2xl font-bold">{myRank ?? "—"}</div>
              <div className="text-[12px] text-white/60 mt-1">
                Score: <span className="text-white/85 font-semibold">{myScore ?? "—"}</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-3 text-[11px] text-white/45">Formula: {formula}</div>
      </BoopCard>

      {/* Top 10 */}
      <BoopCard title={`Top 10 • Page ${page}`} subtitle="Global leaderboard">
        {rows.length === 0 ? (
          <div className="text-sm text-white/60">No rows.</div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const isMe = fidNum && r.fid === fidNum; // چون API isMe ممکنه false باشه
              const pfp = r.pfp || "/brand/boop-app-logo.png";

              return (
                <div
                  key={`${r.fid}-${r.rank}`}
                  className={[
                    "flex items-center justify-between gap-3 rounded-2xl border px-3 py-2",
                    isMe
                      ? "border-yellow-400/35 bg-yellow-400/10"
                      : "border-white/10 bg-white/[0.02]",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 text-center font-bold text-white/85">
                      #{r.rank}
                    </div>

                    <img
                      src={pfp}
                      className="w-9 h-9 rounded-2xl border border-white/10"
                      alt="pfp"
                    />

                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {r.username || `fid_${r.fid}`}{" "}
                        {isMe ? <span className="text-yellow-300 text-[12px]">(You)</span> : null}
                      </div>
                      <div className="text-[11px] text-white/60">
                        XP {fmt(r.xp, 0)} • Lv {r.level} • Streak {r.daily_streak}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-[12px] text-white/60">Score</div>
                    <div className="font-bold">{fmt(r.score, 2)}</div>
                    <div className="text-[11px] text-white/55">
                      Staked: {fmt(r.totalStaked, 0)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between gap-2">
          <GoldButton
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={loading || page <= 1}
          >
            Prev
          </GoldButton>

          <div className="text-[12px] text-white/60">
            Total: {lb?.total ?? "—"} • Limit: {lb?.limit ?? 10}
          </div>

          <GoldButton
            onClick={() => setPage((p) => p + 1)}
            disabled={loading || !lb?.hasMore}
          >
            Next
          </GoldButton>
        </div>
      </BoopCard>

      <div className="text-[11px] text-white/45">
        Tip: This page auto-refreshes every 20 seconds.
      </div>
    </div>
  );
}
