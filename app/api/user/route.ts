import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET() {
  const { data, error } = await supabase
    .from("users")
    .select("id, username, xp, level, daily_streak")
    .eq("username", "guest")
    .single();

  if (error || !data) {
    console.error("Supabase error:", error);
    return NextResponse.json({
      id: "fallback",
      username: "guest",
      xp: 0,
      level: 1,
      dailyStreak: 0,
    });
  }

  return NextResponse.json({
    id: data.id,
    username: data.username,
    xp: data.xp,
    level: data.level,
    dailyStreak: data.daily_streak,
  });
}
