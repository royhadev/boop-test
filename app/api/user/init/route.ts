import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

async function getFarcasterUser(fid: number) {
  if (!NEYNAR_API_KEY) return null;

  const res = await fetch(
    `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
    {
      headers: {
        accept: "application/json",
        api_key: NEYNAR_API_KEY,
      },
    }
  );

  if (!res.ok) return null;

  const json = await res.json();
  return json?.users?.[0] || null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const fidRaw = body?.fid;

    if (!fidRaw) {
      return NextResponse.json({ error: "fid is required" }, { status: 400 });
    }

    const fid = Number(fidRaw);
    if (!Number.isFinite(fid)) {
      return NextResponse.json({ error: "invalid fid" }, { status: 400 });
    }

    // 1️⃣ گرفتن اطلاعات از Neynar
    const fcUser = await getFarcasterUser(fid);

    // 2️⃣ username حتماً باید مقدار داشته باشه
    const username =
      body?.username ||
      fcUser?.username ||
      `fid_${fid}`; // fallback امن برای NOT NULL

    const pfp =
      body?.pfp ||
      fcUser?.pfp_url ||
      null;

    const custody_address =
      body?.custody_address ||
      fcUser?.custody_address ||
      fcUser?.custodyAddress ||
      null;

    // 3️⃣ upsert امن
    const { data, error } = await supabaseAdmin
      .from("users")
      .upsert(
        {
          fid,
          username,
          pfp,
          custody_address,
        },
        { onConflict: "fid" }
      )
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, user: data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
