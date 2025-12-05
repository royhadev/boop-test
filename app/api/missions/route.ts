import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET() {
  // 1) Fetch missions from Supabase
  const { data, error } = await supabase
    .from("missions")
    .select("id, title, description, reward_xp, is_daily, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching missions:", error);
    return NextResponse.json(
      { success: false, message: "Failed to load missions" },
      { status: 500 }
    );
  }

  // 2) Return missions as JSON
  return NextResponse.json({
    success: true,
    missions: data || [],
  });
}
