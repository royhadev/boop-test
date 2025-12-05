import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

// این API فعلا برای یوزر تست "guest" کار می‌کند.
// بعدا که Login با Farcaster را اضافه کنیم، این مقدار را داینامیک می‌کنیم.
export async function POST() {
  const username = "guest";

  // 1) گرفتن اطلاعات کاربر از Supabase
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .single();

  if (error || !user) {
    console.error("User not found or error:", error);
    return NextResponse.json(
      { success: false, message: "User not found" },
      { status: 404 }
    );
  }

  const now = new Date();
  const lastClaim = user.last_daily_claim
    ? new Date(user.last_daily_claim)
    : null;

  // 2) چک کردن اینکه امروز قبلا Claim شده یا نه
  const alreadyClaimedToday =
    lastClaim && lastClaim.toDateString() === now.toDateString();

  if (alreadyClaimedToday) {
    return NextResponse.json({
      success: false,
      message: "Already claimed today",
    });
  }

  // 3) محاسبه‌ی streak جدید
  let newStreak = user.daily_streak;

  if (lastClaim) {
    const diffHours =
      (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60);

    // اگر کمتر از ۴۸ ساعت گذشته باشد Streak ادامه پیدا می‌کند
    if (diffHours < 48) {
      newStreak = user.daily_streak + 1;
    } else {
      // اگر فاصله خیلی زیاد شده باشد، از ۱ شروع می‌شود
      newStreak = 1;
    }
  } else {
    // اولین بار Claim
    newStreak = 1;
  }

  // 4) مقدار XP جایزه‌ی روزانه
  const rewardXP = 20;
  const newXP = user.xp + rewardXP;

  // 5) آپدیت داده‌ها در Supabase
  const { error: updateError } = await supabase
    .from("users")
    .update({
      xp: newXP,
      daily_streak: newStreak,
      last_daily_claim: now.toISOString(),
    })
    .eq("username", username);

  if (updateError) {
    console.error("Error updating user:", updateError);
    return NextResponse.json(
      { success: false, message: "Failed to update user" },
      { status: 500 }
    );
  }

  // 6) پاسخ نهایی
  return NextResponse.json({
    success: true,
    message: "Daily XP claimed successfully",
    rewardXP,
    newXP,
    newStreak,
  });
}
