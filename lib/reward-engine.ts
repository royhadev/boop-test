// lib/rewardEngine.ts
export type AprComponents = {
  base: number;
  nft: number;
  boost: number;
  level: number;
  streak: number;
};

export type AprResult = {
  total: number;
  components: AprComponents;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * تصمیم قطعی:
 * - سقف استیک برای رسیدن به Base APR = 60% => 2,500,000 BOOP
 * - Base APR بین 1,000 تا 2.5M به صورت مونوتونیک زیاد می‌شود و هرگز با افزایش stake کم نمی‌شود
 */
export function computeBaseAprFromTotalStake(totalStaked: number): number {
  const MIN_STAKE = 1000;
  const CAP_STAKE = 2_500_000;
  const MAX_BASE_APR = 60;

  const s = Math.max(0, totalStaked || 0);

  if (s <= 0) return 0;
  if (s >= CAP_STAKE) return MAX_BASE_APR;

  // نرمال‌سازی لگاریتمیِ مونوتونیک
  const num = Math.log10(s / MIN_STAKE + 1);
  const den = Math.log10(CAP_STAKE / MIN_STAKE + 1);
  const t = den === 0 ? 0 : num / den;

  return round2(clamp(MAX_BASE_APR * t, 0, MAX_BASE_APR));
}

/**
 * تصمیم قطعی:
 * Level bonus پلکانی تا سقف +20% (Level 20 => +20%)
 * ساده‌ترین پیاده‌سازی: هر Level = 1%
 */
export function computeLevelBonus(level: number): number {
  const lvl = Math.max(0, Math.floor(level || 0));
  return round2(clamp(lvl, 0, 20));
}

/**
 * Streak تا سقف +10%
 * (برای اینکه streak=1 مثل اسکرین تو => 1% باشد)
 */
export function computeStreakBonus(dailyStreak: number): number {
  const s = Math.max(0, Math.floor(dailyStreak || 0));
  if (s >= 30) return 10;
  if (s >= 14) return 6;
  if (s >= 7) return 3;
  if (s >= 3) return 2;
  if (s >= 1) return 1;
  return 0;
}

export function computeAprTotal(input: {
  totalStaked: number;
  hasActiveNft: boolean;
  hasActiveBoost: boolean;
  level: number;
  dailyStreak: number;
}): AprResult {
  const base = computeBaseAprFromTotalStake(input.totalStaked);
  const nft = input.hasActiveNft ? 20 : 0;
  const boost = input.hasActiveBoost ? 20 : 0;
  const level = computeLevelBonus(input.level);
  const streak = computeStreakBonus(input.dailyStreak);

  const totalRaw = base + nft + boost + level + streak;

  // تصمیم قطعی: سقف نهایی APR = 130%
  const total = round2(clamp(totalRaw, 0, 130));

  return {
    total,
    components: { base, nft, boost, level, streak },
  };
}
