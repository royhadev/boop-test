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
  const [onlyStakers, setOnlyStakers] = useState(false);

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
        `/api/leaderboard?page=${page}&limit=10${fid ? `&fid=${fid}` : ""}${
          onlyStakers ? "&onlyStakers=1" : ""
        }`
      );
      const json = await res.json();
      setRows(json.leaderboard ?? []);
      setHasMore(json.hasMore ?? false);
      setMyRank(json.myRank ?? null);
      setLoading(false);
    }
    load();
  }, [page, fid, onlyStakers]);

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
        <div className="sticky top-0 z-10 bg-black/80 backdrop-blur border border-yellow-400 rounded-lg p-3 flex justify-between items-center">
          <div className="font-bold text-yellow-400">⭐ Your Rank</div>
          <div className="text-sm">
            #{myRank}
            {myScore !== null && (
              <span className="ml-2 opacity-70">Score {myScore}</span>
            )}
          </div>
        </div>
      )}

      {/* Header + Toggle */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">🏆 Leaderboard</h1>
        <button
          onClick={() => {
            setPage(1);
            setOnlyStakers((v) => !v);
          }}
          className={`px-3 py-1 rounded text-sm border transition ${
            onlyStakers
              ? "border-green-400 text-green-300 bg-green-400/10"
              : "border-white/20 text-white/70"
          }`}
        >
          {onlyStakers ? "Only Stakers ✓" : "Only Stakers"}
        </button>
      </div>

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

      {/* Empty State */}
      {!loading && rows.length === 0 && (
        <div className="text-center py-10 opacity-70">
          <div className="text-3xl mb-2">😶‍🌫️</div>
          <div className="font-medium">No users found</div>
          <div className="text-sm mt-1">
            {onlyStakers
              ? "Be the first to stake and climb the leaderboard."
              : "Leaderboard is warming up."}
          </div>
        </div>
      )}

      {/* Rows */}
      {!loading && rows.length > 0 && (
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
                  <div className="w-7 text-center font-bold">
                    #{r.rank}
                  </div>

                  {r.pfp ? (
                    <img
                      src={r.pfp}
                      className="w-9 h-9 rounded-full"
                      alt=""
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-white/10" />
                  )}

                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{r.username}</span>
                      {r.isTop10 && (
                        <span className="animate-pulse">🏆</span>
                      )}
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
          className="px-4 py-2 rounded bg-white/10 disabled:opacity-30"
        >
          ← Prev
        </button>

        <button
          disabled={!hasMore}
          onClick={() => setPage((p) => p + 1)}
          className="px-4 py-2 rounded bg-white/10 disabled:opacity-30"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
