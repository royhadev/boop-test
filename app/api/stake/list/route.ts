import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fidStr = searchParams.get("fid");
    const fid = Number(fidStr);

    if (!fid || Number.isNaN(fid)) {
      return NextResponse.json({ error: "Invalid fid" }, { status: 400 });
    }

    const { data: userRow } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("fid", fid)
      .maybeSingle();

    if (!userRow) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let stakes: any[] = [];

    // user_id first
    {
      const { data } = await supabaseAdmin
        .from("stakes")
        .select("*")
        .eq("user_id", userRow.id)
        .order("started_at", { ascending: false });

      if (data && data.length > 0) stakes = data;
    }

    // fid fallback
    if (stakes.length === 0) {
      const { data } = await supabaseAdmin
        .from("stakes")
        .select("*")
        .eq("fid", fid)
        .order("started_at", { ascending: false });

      if (data) stakes = data;
    }

    return NextResponse.json({
      ok: true,
      fid,
      count: stakes.length,
      stakes,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
