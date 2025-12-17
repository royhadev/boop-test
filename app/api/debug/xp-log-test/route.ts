import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const fid = Number(body?.fid || 0);
  if (!fid) return NextResponse.json({ ok: false, error: "Missing fid" }, { status: 400 });

  const { data: user, error: uErr } = await supabaseAdmin
    .from("users")
    .select("id, fid")
    .eq("fid", fid)
    .single();

  if (uErr || !user) {
    return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
  }

  const nowIso = new Date().toISOString();

  const payloads: any[] = [
    { user_id: user.id, amount: 25, created_at: nowIso },
    { user_id: user.id, amount: 25 },
    { user_id: user.id, xp: 25, created_at: nowIso },
    { user_id: user.id, fid, amount: 25, created_at: nowIso },
    { user_id: user.id, amount: 25, kind: "DAILY_CLAIM", created_at: nowIso },
    { user_id: user.id, amount: 25, type: "DAILY_CLAIM", created_at: nowIso },
  ];

  const attempts: any[] = [];

  for (const p of payloads) {
    const { data, error } = await supabaseAdmin.from("xp_logs").insert(p).select("*").single();
    if (!error) {
      return NextResponse.json({ ok: true, usedPayload: p, row: data });
    }
    attempts.push({ payload: p, error: error.message });
  }

  return NextResponse.json({ ok: false, attempts }, { status: 500 });
}
