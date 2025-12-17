// app/boop/mini-v2/withdraw/WithdrawClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import BoopCard from "../components/BoopCard";

type StakeRow = {
  id: string;
  amount: number;
  status: string;
  unlock_at?: string;
  can_withdraw?: boolean;
};

export default function WithdrawClient({ fid }: { fid: string }) {
  const [rows, setRows] = useState<StakeRow[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);

  const [withdrawableRewards, setWithdrawableRewards] = useState<number>(0);
  const [withdrawingRewards, setWithdrawingRewards] = useState(false);

  const fidOk = useMemo(() => (fid ? String(fid).trim() : ""), [fid]);

  useEffect(() => {
    if (!fidOk) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fidOk]);

  async function loadAll() {
    await Promise.all([loadStakes(), loadRewards()]);
  }

  async function loadStakes() {
    const r = await fetch(`/api/stake/list?fid=${fidOk}`, { cache: "no-store" });
    const j = await r.json();

    const normalized: StakeRow[] = (j?.stakes || []).map((s: any) => {
      const rawAmount =
        s.amount ??
        s.stake_amount ??
        s.staked_amount ??
        s.amount_staked ??
        s.amount_boop ??
        s.boops ??
        s.value ??
        s.principal ??
        0;

      const rawStatus =
        s.status ??
        s.state ??
        (s.is_unstaked ? "pending_unstake" : "active") ??
        "active";

      const rawUnlock =
        s.unlock_at ??
        s.unlockAt ??
        s.unstake_unlock_at ??
        s.unstake_unlocks_at ??
        s.unlocks_at ??
        s.available_at ??
        s.withdrawable_at ??
        undefined;

      const rawCanWithdraw =
        s.can_withdraw ??
        s.is_withdrawable ??
        s.withdrawable ??
        s.ready_to_withdraw ??
        false;

      return {
        id: String(s.id),
        amount: Number(rawAmount || 0),
        status: String(rawStatus || "active"),
        unlock_at: rawUnlock ? String(rawUnlock) : undefined,
        can_withdraw: Boolean(rawCanWithdraw),
      };
    });

    setRows(normalized);
  }

  async function loadRewards() {
    try {
      const r = await fetch(`/api/reward/status?fid=${fidOk}`, { cache: "no-store" });
      const j = await r.json();
      setWithdrawableRewards(Number(j?.withdrawable ?? 0));
    } catch {
      setWithdrawableRewards(0);
    }
  }

  const withdrawableStakes = useMemo(() => {
    const now = Date.now();
    return rows.filter((r) => {
      if (r.can_withdraw) return true;
      if (r.unlock_at) {
        const t = new Date(r.unlock_at).getTime();
        if (Number.isFinite(t) && t <= now) return true;
      }
      if (String(r.status || "").toLowerCase() === "unlocked") return true;
      return false;
    });
  }, [rows]);

  const totalWithdrawableStakes = useMemo(() => {
    return withdrawableStakes.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [withdrawableStakes]);

  async function withdrawRewards() {
    if (!fidOk) return;
    setWithdrawingRewards(true);

    await fetch("/api/reward/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fid: fidOk }),
    });

    await loadRewards();
    setWithdrawingRewards(false);
  }

  async function withdrawOne(stakeId: string) {
    if (!fidOk) return;
    setLoadingId(stakeId);

    await fetch("/api/stake/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fid: fidOk, stakeId }),
    });

    await loadStakes();
    setLoadingId(null);
  }

  async function withdrawAllStakes() {
    if (!fidOk) return;
    if (withdrawableStakes.length === 0) return;

    setLoadingAll(true);
    await fetch("/api/stake/withdraw-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fid: fidOk }),
    });

    await loadStakes();
    setLoadingAll(false);
  }

  return (
    <div className="space-y-4">
      {/* Rewards */}
      <BoopCard title="Rewards" subtitle="Withdraw your claimed BOOP rewards">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[12px] text-white/60">Withdrawable rewards</div>
            <div className="text-2xl font-bold mt-1">{fmt(withdrawableRewards)} BOOP</div>
            <div className="text-[11px] text-white/45 mt-1">Claim daily rewards on Home.</div>
          </div>

          <button
            onClick={withdrawRewards}
            disabled={withdrawingRewards || withdrawableRewards <= 0}
            className="
              px-4 py-2 rounded-xl text-[13px] font-semibold text-black
              bg-gradient-to-r from-[#FFD84D] via-[#FFC300] to-[#FFB800]
              shadow-[0_0_14px_rgba(255,195,0,0.25)]
              disabled:opacity-60 disabled:shadow-none
            "
          >
            {withdrawingRewards ? "..." : "Withdraw Rewards"}
          </button>
        </div>

        <div className="mt-2 text-[11px] text-white/45">
          Fee: 2% (applies on claim)
          <br />
          All fees are allocated to token burn, reward treasury, and team operations.
        </div>
      </BoopCard>

      {/* Withdraw Stakes */}
      <BoopCard title="Withdraw" subtitle="Withdraw unlocked unstake positions">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[12px] text-white/60">Total Withdrawable</div>
            <div className="text-2xl font-bold mt-1">{fmt(totalWithdrawableStakes)} BOOP</div>
            <div className="text-[11px] text-white/45 mt-1">Withdraw fee: 1%</div>
          </div>

          <button
            onClick={withdrawAllStakes}
            disabled={loadingAll || withdrawableStakes.length === 0}
            className="
              px-4 py-2 rounded-xl text-[13px] font-semibold
              border border-yellow-400/30 text-yellow-200
              hover:bg-yellow-400/10
              disabled:opacity-60
            "
          >
            {loadingAll ? "..." : "Withdraw All"}
          </button>
        </div>

        <div className="mt-2 text-[11px] text-white/45">
          All fees are allocated to token burn, reward treasury, and team operations.
        </div>
      </BoopCard>

      {/* List */}
      <BoopCard title="Available to withdraw" subtitle="Unlocked positions only">
        {withdrawableStakes.length === 0 && (
          <div className="text-sm text-white/50">No withdrawable stakes right now.</div>
        )}

        {withdrawableStakes.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between border border-white/10 rounded-xl px-3 py-2 mb-2"
          >
            <div>
              <div className="font-medium">{fmt(s.amount)} BOOP</div>
              <div className="text-xs text-emerald-300">
                Ready ✅ {s.unlock_at ? `(${fmtDate(s.unlock_at)})` : ""}
              </div>
              <div className="text-[11px] text-white/40">ID: {shortId(s.id)}</div>
            </div>

            <button
              onClick={() => withdrawOne(s.id)}
              disabled={loadingId === s.id}
              className="
                px-4 py-2 rounded-xl text-[13px] font-semibold text-black
                bg-gradient-to-r from-[#FFD84D] via-[#FFC300] to-[#FFB800]
                shadow-[0_0_14px_rgba(255,195,0,0.25)]
                active:scale-[0.99]
                transition-all
                disabled:opacity-60 disabled:shadow-none
              "
            >
              {loadingId === s.id ? "..." : "Withdraw"}
            </button>
          </div>
        ))}
      </BoopCard>
    </div>
  );
}

/* utils */
function fmt(n: number) {
  return Number(n || 0).toLocaleString();
}
function fmtDate(v?: string) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
function shortId(id: string) {
  if (!id) return "—";
  return id.length <= 10 ? id : `${id.slice(0, 6)}...${id.slice(-4)}`;
}
