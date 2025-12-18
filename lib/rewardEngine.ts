// lib/rewardEngine.ts

export type BoostKind = "BOOST_24H" | "BOOST_72H" | "BOOST_7D" | "SUPERBOOST" | "UNKNOWN";

const APR = {
  MIN_STAKE: 1_000,              // زیر این = 0%
  BASE_MAX: 60,                  // سقف base
  BASE_STAKE_CAP: 2_500_000,     // طبق تصمیم پروژه (برای رسیدن به 60%)
  STREAK_MAX: 10,
  LEVEL_MAX: 20,
  NFT_MAX: 20,
  BOOST_MAX: 20,
  TOTAL_MAX: 130,

  NFT_MIN_STAKE: 3_500_000,      // شرط فعال شدن NFT Boost
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/**
 * Base APR curve:
 * base = K * log10(stake)
 * K = 60 / log10(2,500,000)
 * clamp 0..60
 */
export function calcBaseApr(stakeAmount: number): number {
  const stake = Number(stakeAmount);
  if (!Number.isFinite(stake) || stake < APR.MIN_STAKE) return 0;

  const x = Math.max(stake, APR.MIN_STAKE);
  const K = APR.BASE_MAX / Math.log10(APR.BASE_STAKE_CAP);
  const raw = K * Math.log10(x);

  return Number(clamp(raw, 0, APR.BASE_MAX).toFixed(2));
}

/**
 * Streak bonus (capped 10)
 */
export function calcStreakBonus(dailyStreak: number): number {
  const s = Number(dailyStreak);
  if (!Number.isFinite(s) || s <= 0) return 0;
  if (s >= 30) return 10;
  if (s >= 14) return 4;
  if (s >= 7) return 2;
  return 1;
}

/**
 * Level bonus: level 20 => +20
 */
export function calcLevelBonus(level: number): number {
  const lv = Number(level);
  if (!Number.isFinite(lv) || lv <= 0) return 0;
  return Number(clamp((Math.min(lv, 20) / 20) * APR.LEVEL_MAX, 0, APR.LEVEL_MAX).toFixed(2));
}

export type AprComponents = {
  base: number;
  nft: number;
  boost: number;
  level: number;
  streak: number;
};

export type AprResult = {
  // ✅ برای user/status و UI
  totalApr: number;
  components: AprComponents;

  // ✅ برای reward/status و reward/claim (این routeها apr.total می‌خوان)
  total: number;

  // برای debug/سازگاری
  raw: {
    base: number;
    nft: number;
    boost: number;
    level: number;
    streak: number;
    total: number;
  };
};

/**
 * calcApr supports BOTH styles:
 * - calcApr({ totalStaked, hasNft, boostActive, level, dailyStreak })
 * - calcApr({ baseApr, totalStaked, hasNft, boostActive, level, dailyStreak })
 */
export function calcApr(params: {
  totalStaked: number;
  baseApr?: number;
  hasNft: boolean;
  boostActive: boolean;
  level: number;
  dailyStreak: number;
}): AprResult {
  const staked = Number(params.totalStaked);
  if (!Number.isFinite(staked) || staked < APR.MIN_STAKE) {
    return {
      totalApr: 0,
      total: 0,
      components: { base: 0, nft: 0, boost: 0, level: 0, streak: 0 },
      raw: { base: 0, nft: 0, boost: 0, level: 0, streak: 0, total: 0 },
    };
  }

  // اگر stake/create apr_base ذخیره کرده بود و می‌خوای همونو مبنا بگیری:
  const baseAprFromDB = Number(params.baseApr ?? 0);
  const base = baseAprFromDB > 0 ? clamp(baseAprFromDB, 0, APR.BASE_MAX) : calcBaseApr(staked);

  const nftActive = !!params.hasNft && staked >= APR.NFT_MIN_STAKE;
  const nft = nftActive ? APR.NFT_MAX : 0;

  const boost = params.boostActive ? APR.BOOST_MAX : 0;
  const level = calcLevelBonus(params.level);
  const streak = calcStreakBonus(params.dailyStreak);

  const total = Number(clamp(base + nft + boost + level + streak, 0, APR.TOTAL_MAX).toFixed(2));

  return {
    totalApr: total,      // ✅ UI
    total,               // ✅ reward routes
    components: {
      base: Number(base.toFixed(2)),
      nft,
      boost,
      level: Number(level.toFixed(2)),
      streak,
    },
    raw: { base, nft, boost, level, streak, total },
  };
}

/**
 * reward delta (BOOP):
 * delta = staked * (apr%/100) * (dt / 365days)
 */
export function calcRewardDelta(params: {
  stakedAmount: number;
  aprPercent: number;
  fromMs: number;
  toMs: number;
}): number {
  const staked = Number(params.stakedAmount);
  const apr = Number(params.aprPercent);
  const from = Number(params.fromMs);
  const to = Number(params.toMs);

  if (!Number.isFinite(staked) || staked <= 0) return 0;
  if (!Number.isFinite(apr) || apr <= 0) return 0;
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 0;

  const dtSec = (to - from) / 1000;
  const yearSec = 365 * 24 * 3600;

  const delta = staked * (apr / 100) * (dtSec / yearSec);
  if (!Number.isFinite(delta)) return 0;

  // دقت بالا برای UI
  return Number(delta.toFixed(8));
}

/**
 * Score formula (طبق تصمیم):
 * score = xp + log10(totalStaked + 1) * 100
 * (rounded down)
 */
export function calcScore(
  a: number | { xp: number; totalStaked: number },
  b?: number
): number {
  let xp = 0;
  let totalStaked = 0;

  if (typeof a === "object") {
    xp = Number(a.xp || 0);
    totalStaked = Number(a.totalStaked || 0);
  } else {
    xp = Number(a || 0);
    totalStaked = Number(b || 0);
  }

  if (!Number.isFinite(xp)) xp = 0;
  if (!Number.isFinite(totalStaked) || totalStaked < 0) totalStaked = 0;

  const stakePart = Math.log10(totalStaked + 1) * 100;
  return Math.floor(xp + stakePart);
}

// Alias for API routes expecting computeScore
export const computeScore = calcScore;
