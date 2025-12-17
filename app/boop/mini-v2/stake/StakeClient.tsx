// app/boop/mini-v2/stake/StakeClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import BoopCard from "../components/BoopCard";
import GoldButton from "../components/GoldButton";

type StakeRow = {
  id: string;
  amount: number;
  status: "active" | "pending_unstake" | "unlocked";
  unlock_at?: string;
};

type AprObj = {
  totalApr?: number;
  components?: {
    base?: number;
    level?: number;
    streak?: number;
    nft?: number;
    boost?: number;
  };
};

export default function StakeClient({ fid }: { fid: string }) {
  const [rows, setRows] = useState<StakeRow[]>([]);
  const [amount, setAmount] = useState("");
  const [totalStaked, setTotalStaked] = useState(0);
  const [totalApr, setTotalApr] = useState(0);
  const [aprObj, setAprObj] = useState<AprObj | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!fid) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fid]);

  const active = useMemo(() => rows.filter((r) => r.status === "active"), [rows]);
  const pending = useMemo(() => rows.filter((r) => r.status === "pending_unstake"), [rows]);

  useEffect(() => {
    if (pending.length === 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pending.length]);

  async function load() {
    // stakes
    const r = await fetch(`/api/stake/list?fid=${fid}`, { cache: "no-store" });
    const j = await r.json();

    const normalized: StakeRow[] = (j?.stakes || []).map((s: any) => ({
      id: String(s.id),
      amount: Number(s.staked_amount ?? s.amount ?? 0),
      status:
        s.status === "unlocked"
          ? "unlocked"
          : s.status === "pending_unstake"
          ? "pending_unstake"
          : "active",
      unlock_at: s.unlock_at,
    }));

    setRows(normalized);

    setTotalStaked(
      normalized.filter((r) => r.status === "active").reduce((a, b) => a + b.amount, 0)
    );

    // APR (canonical)
    const rs = await fetch(`/api/reward/status?fid=${fid}`, { cache: "no-store" });
    const rj = await rs.json();
    setTotalApr(Number(rj?.apr?.totalApr ?? 0));
    setAprObj(rj?.apr ?? null);
  }

  async function onStake() {
    if (!amount) return;
    setLoading(true);
    await fetch("/api/stake/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fid, amount }),
    });
    setAmount("");
    await load();
    setLoading(false);
  }

  async function onUnstake(id: string) {
    setLoading(true);
    await fetch("/api/stake/unstake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fid, stakeId: id }),
    });
    await load();
    setLoading(false);
  }

  const c = aprObj?.components;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <BoopCard title="Stake" subtitle="Your total stake and APR">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[12px] text-white/60">Total Staked</div>
            <div className="text-2xl font-bold mt-1">{totalStaked.toLocaleString()} BOOP</div>
          </div>

          <div className="text-right">
            <div className="text-[12px] text-white/60">Total APR</div>
            <div className="text-2xl font-bold mt-1">{Number(totalApr).toFixed(2)}%</div>
          </div>
        </div>

        {c && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-white/70">
            <div>Base: {Number(c.base ?? 0).toFixed(2)}%</div>
            <div>Level: {Number(c.level ?? 0).toFixed(2)}%</div>
            <div>Streak: {Number(c.streak ?? 0).toFixed(2)}%</div>
            <div>NFT: {Number(c.nft ?? 0).toFixed(2)}%</div>
            <div>Boost: {Number(c.boost ?? 0).toFixed(2)}%</div>
          </div>
        )}
      </BoopCard>

      {/* New Stake */}
      <BoopCard title="New Stake">
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm"
          />
          <GoldButton onClick={onStake} disabled={loading}>
            Stake
          </GoldButton>
        </div>
      </BoopCard>

      {/* Active */}
      <BoopCard title="Active Stakes">
        {active.length === 0 && <div className="text-sm text-white/50">No active stakes.</div>}

        {active.map((s) => (
          <div
            key={s.id}
            className="flex justify-between border border-white/10 rounded-xl px-3 py-2 mb-2"
          >
            <div>
              <div className="font-medium">{s.amount.toLocaleString()} BOOP</div>
              <div className="text-xs text-green-400">active</div>
            </div>

            <button
              onClick={() => onUnstake(s.id)}
              disabled={loading}
              className="
                shrink-0 rounded-xl px-4 py-2 text-sm font-semibold
                border border-red-400/40 text-red-400
                hover:bg-red-400/10
                active:scale-[0.97]
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              Unstake
            </button>
          </div>
        ))}
      </BoopCard>

      {/* Pending */}
      <BoopCard title="Pending Unstake">
        {pending.length === 0 && <div className="text-sm text-white/50">No pending unstake.</div>}

        {pending.map((s) => (
          <div
            key={s.id}
            className="flex justify-between border border-white/10 rounded-xl px-3 py-2 mb-2"
          >
            <div>
              <div className="font-medium">{s.amount.toLocaleString()} BOOP</div>
              <div className="text-xs text-yellow-400">Unlock: {fmtCountdown(s.unlock_at, now)}</div>
            </div>
          </div>
        ))}
      </BoopCard>
    </div>
  );
}

function fmtCountdown(v?: string, nowMs?: number) {
  if (!v) return "—";
  const target = new Date(v).getTime();
  const now = nowMs ?? Date.now();
  const diff = target - now;
  if (diff <= 0) return "Ready";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  return `${d}d ${h}h`;
}
