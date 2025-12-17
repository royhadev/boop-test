"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type LeaderRow = {
  fid: number;
  username: string | null;
  pfp: string | null;
  xp: number;
  level: number;
  daily_streak: number;
  totalStaked: number;
  score: number;
  rank: number;
  isTop10?: boolean;
  isStaker?: boolean;
};

function fmtNum(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  try {
    return new Intl.NumberFormat("en-US").format(n);
  } catch {
    return String(n);
  }
}

function fmtScore(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

export default function LeaderboardPage() {
  const sp = useSearchParams();
  const fid = useMemo(() => Number(sp.get("fid") || 0), [sp]);

  const [mode, setMode] = useState<"global" | "monthly">("global");

  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [hasMore, setHasMore] = useState(false);

  const [myRank, setMyRank] = useState<number | null>(null);
  const [myScore, setMyScore] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [formula, setFormula] = useState<string | null>(null);

  const [monthlyFallback, setMonthlyFallback] = useState<boolean>(false);
  const [monthlyKey, setMonthlyKey] = useState<string | null>(null);

  async function fetchAll(p: number, isRefresh = false) {
    if (!fid) return;

    try {
      setError(null);
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const ts = Date.now();

      const lbUrl = `/api/leaderboard?mode=${mode}&page=${p}&limit=${limit}&ts=${ts}`;
      const meUrl = `/api/leaderboard/me?fid=${fid}&ts=${ts}`;

      const [lbRes, meRes] = await Promise.all([fetch(lbUrl, { cache: "no-store" }), fetch(meUrl, { cache: "no-store" })]);

      const lbJson = await lbRes.json();
      const meJson = await meRes.json();

      if (!lbRes.ok || !lbJson?.ok) {
        throw new Error(lbJson?.error || "Failed to load leaderboard");
      }
      if (!meRes.ok || !meJson?.ok) {
        throw new Error(meJson?.error || "Failed to load my rank");
      }

      setRows(Array.isArray(lbJson.leaderboard) ? lbJson.leaderboard : []);
      setTotal(Number(lbJson.total || 0));
      setHasMore(Boolean(lbJson.hasMore));
      setFormula(lbJson.formula || null);

      setMyRank(meJson.myRank ?? null);
      setMyScore(meJson.myScore ?? null);

      if (mode === "monthly") {
        setMonthlyFallback(Boolean(lbJson?.monthly?.fallback));
        setMonthlyKey(lbJson?.monthly?.monthKey || null);
      } else {
        setMonthlyFallback(false);
        setMonthlyKey(null);
      }
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    setPage(1);
  }, [fid, mode]);

  useEffect(() => {
    fetchAll(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fid, page, mode]);

  const canPrev = page > 1;
  const canNext = hasMore;

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold">Leaderboard</div>
          <div className="text-sm text-white/60">Rank up with XP, streak and staking.</div>
        </div>

        <button
          onClick={() => fetchAll(page, true)}
          disabled={refreshing || loading || !fid}
          className={`px-4 py-2 rounded-xl border border-white/10 text-sm ${
            refreshing || loading ? "opacity-60 cursor-not-allowed" : "hover:border-white/20"
          }`}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Tabs (minimal UI) */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("global")}
          className={`px-3 py-2 rounded-xl border text-sm ${
            mode === "global"
              ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-200"
              : "border-white/10 bg-white/[0.02] text-white/70 hover:border-white/20"
          }`}
        >
          Global
        </button>
        <button
          onClick={() => setMode("monthly")}
          className={`px-3 py-2 rounded-xl border text-sm ${
            mode === "monthly"
              ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-200"
              : "border-white/10 bg-white/[0.02] text-white/70 hover:border-white/20"
          }`}
        >
          Monthly
        </button>

        {mode === "monthly" && monthlyKey ? (
          <div className="ml-auto text-xs text-white/55 flex items-center">
            Period: <span className="text-white/75 ml-1">{monthlyKey}</span>
            {monthlyFallback ? (
              <span className="ml-2 px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.03] text-white/60">
                fallback
              </span>
            ) : null}
          </div>
        ) : (
          <div className="ml-auto" />
        )}
      </div>

      {/* Airdrop countdown (UI only placeholder) */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Next Airdrop</div>
            <div className="text-xs text-white/60">Countdown (UI only)</div>
          </div>
          <div className="text-xs text-white/60">{mode === "monthly" ? "Monthly" : "Global"}</div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="text-2xl font-semibold tracking-widest text-white/70">— — : — — : — —</div>
          <div className="text-2xl">🎁</div>
        </div>

        <div className="mt-2 text-xs text-white/50">
          Countdown will be wired later (no new API in this phase).
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
          <div className="font-semibold">Error</div>
          <div className="text-white/80 mt-1">{error}</div>
        </div>
      )}

      {/* My Rank */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">My Rank</div>
            <div className="text-xs text-white/60">FID: {fid || "—"}</div>
          </div>
          <div className="text-xs text-white/60">Live</div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="text-xs text-white/60">Rank</div>
            <div className="text-lg font-semibold">{myRank ?? "—"}</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="text-xs text-white/60">Score</div>
            <div className="text-lg font-semibold">{fmtScore(myScore)}</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="text-xs text-white/60">Page</div>
            <div className="text-lg font-semibold">{page}</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="text-xs text-white/60">Total Users</div>
            <div className="text-lg font-semibold">{fmtNum(total)}</div>
          </div>
        </div>

        {formula && (
          <div className="mt-3 text-xs text-white/45">
            Formula: <span className="text-white/55">{formula}</span>
          </div>
        )}
      </div>

      {/* Global / Monthly list */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{mode === "monthly" ? "Monthly" : "Global"}</div>
            <div className="text-xs text-white/60">
              Top {limit} — page {page}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => canPrev && setPage((p) => Math.max(1, p - 1))}
              disabled={!canPrev || loading}
              className={`px-3 py-1.5 rounded-lg border border-white/10 text-xs ${
                !canPrev || loading ? "opacity-50 cursor-not-allowed" : "hover:border-white/20"
              }`}
            >
              Prev
            </button>
            <button
              onClick={() => canNext && setPage((p) => p + 1)}
              disabled={!canNext || loading}
              className={`px-3 py-1.5 rounded-lg border border-white/10 text-xs ${
                !canNext || loading ? "opacity-50 cursor-not-allowed" : "hover:border-white/20"
              }`}
            >
              Next
            </button>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="text-sm text-white/60">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-white/60">No rows.</div>
          ) : (
            rows.map((r) => {
              const isMe = fid && r.fid === fid;

              return (
                <div
                  key={`${r.fid}-${r.rank}`}
                  className={`rounded-xl border p-3 flex items-center justify-between ${
                    isMe ? "border-yellow-400/40 bg-yellow-400/10" : "border-white/10 bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-white/10 overflow-hidden flex items-center justify-center shrink-0">
                      {r.pfp ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.pfp} alt="pfp" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-xs text-white/60">—</div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold truncate max-w-[180px]">{r.username || `fid_${r.fid}`}</div>
                        {isMe && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-400/20 border border-yellow-400/30 text-yellow-200">
                            YOU
                          </span>
                        )}
                        {r.rank <= 10 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-white/70">
                            TOP10
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-white/60">
                        Rank #{r.rank} • XP {fmtNum(r.xp)} • L{r.level} • Streak {fmtNum(r.daily_streak)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold">{fmtScore(r.score)}</div>
                    <div className="text-xs text-white/60">Stake {fmtNum(r.totalStaked)}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
