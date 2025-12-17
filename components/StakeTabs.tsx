"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, boop, Button, Card, CountPill } from "@/components/ui/BoopUI";

type StakeRow = {
  id: string;
  user_id?: string;

  staked_amount?: number;
  amount?: number;
  value?: number;

  apr_base?: number;

  started_at?: string | null;
  unlock_at?: string | null;

  status?: string; // "active" | "pending_unstake"

  last_reward_at?: string | null;
  unclaimed_reward?: number;

  fast_unstake_used?: boolean;
  fast_unstake_fee_boops?: number;
};

type StakeListResp = {
  ok?: boolean;
  success?: boolean;
  fid?: number;
  count?: number;
  stakes?: StakeRow[];
  error?: string;
  message?: string;
  details?: string;
  msg?: string;
};

function normStatus(v: any) {
  return String(v ?? "").toLowerCase();
}

function isOptimisticId(id: string) {
  return String(id).startsWith("optimistic-");
}

function pickAmount(s: StakeRow): number {
  const a =
    (typeof s.staked_amount === "number" ? s.staked_amount : undefined) ??
    (typeof s.amount === "number" ? s.amount : undefined) ??
    (typeof s.value === "number" ? s.value : undefined);
  return Number(a || 0);
}

function fmtNum(n: number) {
  try {
    return new Intl.NumberFormat().format(n);
  } catch {
    return String(n);
  }
}

function fmtDateShort(s?: string | null) {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleString(undefined, {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(s);
  }
}

function pickErr(j: any, statusCode?: number) {
  return (
    j?.error ||
    j?.message ||
    j?.details ||
    j?.msg ||
    (statusCode ? `Request failed (HTTP ${statusCode})` : "Request failed")
  );
}

function parseBoopAmount(raw: string): number {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const ar = "٠١٢٣٤٥٦٧٨٩";

  let s = (raw || "").trim();
  for (let i = 0; i < 10; i++) {
    s = s.replaceAll(fa[i], String(i)).replaceAll(ar[i], String(i));
  }

  s = s.replaceAll(",", "").replaceAll(" ", "").replaceAll("_", "");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

// ---------- localStorage helpers (per fid) ----------
function lsKey(fid: number) {
  return `boop:stake:optimistic:${fid}`;
}

function readOptimistic(fid: number): StakeRow[] {
  try {
    const raw = localStorage.getItem(lsKey(fid));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x) => x && typeof x.id === "string" && isOptimisticId(x.id));
  } catch {
    return [];
  }
}

function writeOptimistic(fid: number, rows: StakeRow[]) {
  try {
    localStorage.setItem(lsKey(fid), JSON.stringify(rows));
  } catch {
    // ignore
  }
}

type TabKey = "active" | "pending";

export default function StakeTabs({ fid }: { fid: number }) {
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [stakes, setStakes] = useState<StakeRow[]>([]);
  const [amount, setAmount] = useState("");

  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [stakeBusy, setStakeBusy] = useState(false);
  const [unstakeBusyIds, setUnstakeBusyIds] = useState<Set<string>>(new Set());

  const [tab, setTab] = useState<TabKey>("active");

  const loadSeq = useRef(0);
  const bootedRef = useRef(false);
  const msgTimer = useRef<any>(null);
  const errTimer = useRef<any>(null);

  function showMsg(t: string) {
    setMsg(t);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(""), 2200);
  }

  function showErr(t: string) {
    setErr(t);
    if (errTimer.current) clearTimeout(errTimer.current);
    errTimer.current = setTimeout(() => setErr(""), 3500);
  }

  useEffect(() => {
    return () => {
      if (msgTimer.current) clearTimeout(msgTimer.current);
      if (errTimer.current) clearTimeout(errTimer.current);
    };
  }, []);

  // ✅ restore optimistic from localStorage (only once)
  useEffect(() => {
    if (!fid) return;
    if (bootedRef.current) return;
    bootedRef.current = true;

    const opt = readOptimistic(fid);
    if (opt.length) setStakes((prev) => [...opt, ...prev]);
  }, [fid]);

  async function load(opts?: { silent?: boolean }) {
    const silent = opts?.silent === true;
    const seq = ++loadSeq.current;

    if (silent) setRefreshing(true);
    else setInitialLoading(true);

    if (!silent) {
      setErr("");
      setMsg("");
    }

    try {
      const r = await fetch(`/api/stake/list?fid=${encodeURIComponent(String(fid))}`, {
        method: "GET",
        cache: "no-store",
      });

      const j = (await r.json().catch(() => ({}))) as StakeListResp;
      const ok = r.ok && (j?.ok === true || j?.success === true);

      if (seq !== loadSeq.current) return;

      if (!ok) {
        showErr(String(pickErr(j, r.status)));
        return;
      }

      const apiStakes = Array.isArray(j.stakes) ? j.stakes : [];

      setStakes((prev) => {
        const prevOpt = prev.filter((s) => isOptimisticId(String(s.id)));
        const lsOpt = readOptimistic(fid);

        const allOptMap = new Map<string, StakeRow>();
        for (const o of [...lsOpt, ...prevOpt]) allOptMap.set(String(o.id), o);
        const keepOpt = Array.from(allOptMap.values());

        writeOptimistic(fid, keepOpt);
        return [...keepOpt, ...apiStakes];
      });
    } catch (e: any) {
      if (seq !== loadSeq.current) return;
      showErr(e?.message || "Network error");
    } finally {
      if (seq !== loadSeq.current) return;
      if (silent) setRefreshing(false);
      else setInitialLoading(false);
    }
  }

  useEffect(() => {
    if (!fid) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fid]);

  const sortedStakes = useMemo(() => {
    const rank = (s?: string) => {
      const x = String(s ?? "").toLowerCase();
      if (x === "active") return 0;
      if (x === "pending_unstake") return 1;
      return 2;
    };

    return [...stakes].sort((a, b) => {
      const ra = rank(a.status);
      const rb = rank(b.status);
      if (ra !== rb) return ra - rb;

      const aStatus = normStatus(a.status);
      const bStatus = normStatus(b.status);

      if (aStatus === "pending_unstake" && bStatus === "pending_unstake") {
        const ua = a.unlock_at ? new Date(a.unlock_at).getTime() : Number.MAX_SAFE_INTEGER;
        const ub = b.unlock_at ? new Date(b.unlock_at).getTime() : Number.MAX_SAFE_INTEGER;
        if (ua !== ub) return ua - ub;
      }

      const ta = a.started_at ? new Date(a.started_at).getTime() : 0;
      const tb = b.started_at ? new Date(b.started_at).getTime() : 0;
      return tb - ta;
    });
  }, [stakes]);

  const activeStakes = useMemo(
    () => sortedStakes.filter((s) => normStatus(s.status) === "active"),
    [sortedStakes]
  );
  const pendingStakes = useMemo(
    () => sortedStakes.filter((s) => normStatus(s.status) === "pending_unstake"),
    [sortedStakes]
  );

  const listForTab = tab === "active" ? activeStakes : pendingStakes;

  const totals = useMemo(() => {
    let active = 0;
    let pending = 0;
    let unclaimed = 0;

    for (const s of stakes) {
      const st = normStatus(s.status);
      const amt = pickAmount(s);
      const u = Number(s.unclaimed_reward || 0);

      if (st === "active") active += amt;
      else if (st === "pending_unstake") pending += amt;

      unclaimed += u;
    }

    return { active, pending, unclaimed };
  }, [stakes]);

  async function onStake(e?: React.MouseEvent<HTMLButtonElement>) {
    e?.preventDefault();
    e?.stopPropagation?.();

    setErr("");
    setMsg("");

    const amt = parseBoopAmount(amount);
    if (!fid || !Number.isFinite(amt) || amt <= 0) {
      showErr("Amount is not valid");
      return;
    }

    setStakeBusy(true);

    const optimisticId = `optimistic-${Date.now()}`;
    const now = new Date().toISOString();

    const optimisticRow: StakeRow = {
      id: optimisticId,
      staked_amount: amt,
      apr_base: 0,
      started_at: now,
      unlock_at: null,
      status: "active",
      unclaimed_reward: 0,
    };

    setStakes((prev) => [optimisticRow, ...prev]);
    writeOptimistic(fid, [optimisticRow, ...readOptimistic(fid)]);
    setTab("active");

    try {
      const r = await fetch("/api/stake/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fid, amount: amt, staked_amount: amt }),
      });

      const j: any = await r.json().catch(() => ({}));

      if (!r.ok) {
        setStakes((prev) => prev.filter((x) => String(x.id) !== optimisticId));
        writeOptimistic(fid, readOptimistic(fid).filter((x) => String(x.id) !== optimisticId));
        showErr(String(pickErr(j, r.status)));
        return;
      }

      const newStake: StakeRow | null = j?.stake && typeof j?.stake?.id === "string" ? j.stake : null;

      showMsg(j?.message || "Stake created successfully");
      setAmount("");

      if (newStake) {
        setStakes((prev) => {
          const withoutOpt = prev.filter((x) => String(x.id) !== optimisticId);
          return [newStake, ...withoutOpt];
        });
        writeOptimistic(fid, readOptimistic(fid).filter((x) => String(x.id) !== optimisticId));
      }

      setTimeout(() => load({ silent: true }), 700);
    } catch (e: any) {
      setStakes((prev) => prev.filter((x) => String(x.id) !== optimisticId));
      writeOptimistic(fid, readOptimistic(fid).filter((x) => String(x.id) !== optimisticId));
      showErr(e?.message || "Stake failed");
    } finally {
      setStakeBusy(false);
    }
  }

  async function onUnstake(stakeId: string, e?: React.MouseEvent<HTMLButtonElement>) {
    e?.preventDefault();
    e?.stopPropagation?.();

    setErr("");
    setMsg("");

    setUnstakeBusyIds((prev) => new Set(prev).add(stakeId));

    let snapshot: StakeRow | null = null;
    setStakes((prev) =>
      prev.map((x) => {
        if (String(x.id) !== String(stakeId)) return x;
        snapshot = { ...x };
        return { ...x, status: "pending_unstake" };
      })
    );

    try {
      const r = await fetch("/api/stake/unstake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fid, stakeId, stake_id: stakeId, id: stakeId }),
      });

      const j: any = await r.json().catch(() => ({}));
      const ok = r.ok && (j?.ok === true || j?.success === true);

      if (!ok) {
        if (snapshot) {
          setStakes((prev) => prev.map((x) => (String(x.id) === String(stakeId) ? snapshot! : x)));
        }
        showErr(String(pickErr(j, r.status)));
      } else {
        showMsg("Unstake requested ✅");
        setTimeout(() => load({ silent: true }), 500);
      }
    } catch (e: any) {
      if (snapshot) {
        setStakes((prev) => prev.map((x) => (String(x.id) === String(stakeId) ? snapshot! : x)));
      }
      showErr(e?.message || "Unstake failed");
    } finally {
      setUnstakeBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(stakeId);
        return next;
      });
    }
  }

  function tabBtnStyle(active: boolean) {
    return {
      height: 36,
      padding: "0 12px",
      borderRadius: 12,
      border: active ? "1px solid rgba(255,255,255,0.22)" : "1px solid rgba(255,255,255,0.12)",
      background: active ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
      color: "#fff",
      cursor: "pointer",
      fontWeight: 900,
      fontSize: 12,
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
    } as const;
  }

  if (initialLoading) {
    return <div style={{ padding: 14, color: "#cfcfcf" }}>Loading…</div>;
  }

  return (
    <div style={{ padding: 14 }}>
      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 950, marginBottom: 10 }}>Stake</div>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (BOOP)"
            style={boop.input}
          />

          <Button onClick={onStake} disabled={stakeBusy}>
            {stakeBusy ? "..." : "Stake"}
          </Button>
        </div>

        <div style={{ marginTop: 8, opacity: 0.65, fontSize: 12 }}>
          Uses <code>/api/stake/create</code>
        </div>
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 950 }}>Summary</div>

          <Button variant="pill" onClick={() => load({ silent: true })} disabled={refreshing}>
            {refreshing ? "Syncing…" : "Refresh"}
          </Button>
        </div>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ minWidth: 160 }}>
            <div style={boop.label}>Total Active Staked</div>
            <div style={boop.value}>{fmtNum(totals.active)} BOOP</div>
          </div>

          <div style={{ minWidth: 160 }}>
            <div style={boop.label}>Total Pending Unstake</div>
            <div style={boop.value}>{fmtNum(totals.pending)} BOOP</div>
          </div>

          <div style={{ minWidth: 160 }}>
            <div style={boop.label}>Total Unclaimed</div>
            <div style={boop.value}>{totals.unclaimed.toFixed(6)} BOOP</div>
          </div>
        </div>
      </Card>

      {err ? <div style={{ marginBottom: 10, color: "#ff6b6b", fontSize: 12 }}>{err}</div> : null}
      {msg ? <div style={{ marginBottom: 10, color: "#8cffb0", fontSize: 12 }}>{msg}</div> : null}

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={() => setTab("active")} style={tabBtnStyle(tab === "active")}>
          Active <CountPill n={activeStakes.length} />
        </button>

        <button type="button" onClick={() => setTab("pending")} style={tabBtnStyle(tab === "pending")}>
          Pending <CountPill n={pendingStakes.length} />
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {listForTab.length === 0 ? (
          <Card style={{ opacity: 0.75, fontSize: 13 }}>
            {tab === "active" ? "No active stakes yet." : "No pending unstake positions."}
          </Card>
        ) : null}

        {listForTab.map((s) => {
          const id = String(s.id);
          const status = normStatus(s.status);

          const amt = pickAmount(s);
          const apr = Number(s.apr_base || 0);
          const unclaimed = Number(s.unclaimed_reward || 0);

          const startedAt = s.started_at ?? null;
          const unlockAt = s.unlock_at ?? null;

          const busy = unstakeBusyIds.has(id);
          const optimistic = isOptimisticId(id);

          const badgeKind =
            status === "active" ? "active" : status === "pending_unstake" ? "pending" : "other";

          const badgeText =
            status === "active" ? "ACTIVE" : status === "pending_unstake" ? "PENDING" : (status || "—").toUpperCase();

          return (
            <Card key={id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 950 }}>
                  {fmtNum(amt)} BOOP{" "}
                  {optimistic ? <span style={{ opacity: 0.55, fontSize: 12 }}>(syncing)</span> : null}
                </div>
                <Badge text={badgeText} kind={badgeKind as any} />
              </div>

              <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={boop.subtle}>
                  APR base: <b>{apr}%</b>
                </div>
                <div style={boop.subtle}>
                  Unclaimed: <b>{unclaimed}</b>
                </div>
              </div>

              <div style={{ marginTop: 12, ...boop.subtle }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>Started</div>
                  <div>{fmtDateShort(startedAt)}</div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>Unlock</div>
                  <div>{unlockAt ? fmtDateShort(unlockAt) : "—"}</div>
                </div>
              </div>

              <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                <Button
                  variant="danger"
                  onClick={(e) => onUnstake(id, e)}
                  disabled={busy || status !== "active" || optimistic}
                >
                  {busy ? "..." : "Unstake"}
                </Button>
              </div>

              <div style={boop.mono}>stakeId: {id}</div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
