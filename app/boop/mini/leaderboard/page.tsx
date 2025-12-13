"use client";

import { useEffect, useRef, useState } from "react";

type Row = {
  fid: number;
  username: string;
  pfp: string | null;
  xp: number;
  level: number;
  totalStaked: number;
  score: number;
  rank: number;
  isMe: boolean;
  isTop10: boolean;
  isStaker: boolean;
};

export default function LeaderboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myScore, setMyScore] = useState<number | null>(null);

  const myRowRef = useRef<HTMLDivElement | null>(null);

  const fid =
    typeof window !== "undefined"
      ? Number(new URLSearchParams(window.location.search).get("fid"))
      : null;

  // Load leaderboard page
  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch(
        `/api/leaderboard?page=${page}&limit=10${fid ? `&fid=${fid}` : ""}`
      );
      const json = await res.json();
      setRows(json.leaderboard ?? []);
      setHasMore(json.hasMore ?? false);
      setMyRank(json.myRank ?? null);
      setLoading(false);
    }
    load();
  }, [page, fid]);

  // Load my rank box
  useEffect(() => {
    if (!fid) return;
    async function loadMe() {
      const res = await fetch(`/api/leaderboard/me?fid=${fid}`);
      const json = await res.json();
      setMyRank(json.myRank ?? null);
      setMyScore(json.myScore ?? null);
    }
    loadMe();
  }, [fid]);

  // Auto-scroll to my row
  useEffect(() => {
    if (myRowRef.current) {
      myRowRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [rows]);

  return (
    <div className="p-4 max-w-xl mx-auto text-white space-y-4">
      {/* Sticky My Rank */}
      {myRank && (
        <div className="sticky top-0 z-10 bg-black/80 backdrop-blur border border-yellow-400 rounded-lg p-3 flex justify-between">
          <div className="font-bold text-yellow-400">⭐ Your Rank</div>
          <div>
            #{myRank}
            {myScore !== null && (
              <span className="ml-2 opacity-70">Score {myScore}</span>
            )}
          </div>
        </div>
      )}

      <h1 className="text-xl font-bold">🏆 Leaderboard</h1>

      {/* Skeleton */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-lg bg-white/10 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Rows */}
      {!loading && (
        <div className="space-y-2">
          {rows.map((r) => {
            const isMe = r.isMe;
            return (
              <div
                key={r.fid}
                ref={isMe ? myRowRef : null}
                className={`flex items-center justify-between p-3 rounded-lg border transition
                  ${
                    isMe
                      ? "bg-yellow-500/10 border-yellow-400"
                      : "bg-white/5 border-white/10"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 text-center font-bold">
                    #{r.rank}
                  </div>

                  {r.pfp ? (
                    <img
                      src={r.pfp}
                      className="w-8 h-8 rounded-full"
                      alt=""
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white/10" />
                  )}

                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{r.username}</span>
                      {r.isTop10 && <span>🏆</span>}
                      {r.isStaker && <span>💰</span>}
                    </div>
                    <div className="text-xs opacity-60">
                      XP {r.xp} · Level {r.level}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold">{r.score}</div>
                  <div className="text-xs opacity-60">Score</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      <div className="flex justify-between pt-2">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="px-3 py-1 rounded bg-white/10 disabled:opacity-30"
        >
          ← Prev
        </button>

        <button
          disabled={!hasMore}
          onClick={() => setPage((p) => p + 1)}
          className="px-3 py-1 rounded bg-white/10 disabled:opacity-30"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
