import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 10)));

  // آخرین رکوردها
  const { data, error } = await supabaseAdmin
    .from("xp_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, count: data?.length || 0, rows: data || [] });
}
