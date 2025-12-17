import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { computeScore } from "@/lib/rewardEngine";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fid = Number(searchParams.get("fid"));
    if (!fid) {
      return NextResponse.json({ ok: false, error: "Missing fid" }, { status: 400 });
    }

    // Load users
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("id,fid,xp,level");

    if (!users) throw new Error("Failed to load users");

    // Load stakes
    const { data: stakes } = await supabaseAdmin
      .from("stakes")
      .select("user_id,staked_amount,status");

    if (!stakes) throw new Error("Failed to load stakes");

    // Aggregate active stakes
    const stakeMap = new Map<string, number>();
    for (const s of stakes) {
      if ((s.status ?? "").toLowerCase() !== "active") continue;
      stakeMap.set(
        s.user_id,
        (stakeMap.get(s.user_id) ?? 0) + Number(s.staked_amount || 0)
      );
    }

    // Build & sort rows EXACTLY like /leaderboard
    const rows = users
      .map(u => {
        const totalStaked = stakeMap.get(u.id) ?? 0;
        const xp = Number(u.xp || 0);
        return {
          fid: u.fid,
          score: Math.round((xp + Math.log10(totalStaked + 1) * 100) * 100) / 100
        };
      })
      .sort((a, b) => b.score - a.score);

    const rank = rows.findIndex(r => r.fid === fid) + 1;
    const me = rows.find(r => r.fid === fid);

    return NextResponse.json({
      ok: true,
      myRank: rank > 0 ? rank : null,
      myScore: me?.score ?? null
    });

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
