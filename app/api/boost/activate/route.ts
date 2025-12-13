import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BOOST_DURATION: Record<string, number> = {
  BOOST_24H: 24 * 60 * 60 * 1000,
  BOOST_72H: 72 * 60 * 60 * 1000,
  BOOST_7D: 7 * 24 * 60 * 60 * 1000,
};

async function getUserByFid(fid: number) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("fid", fid)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

function isBoostRowActive(row: any): boolean {
  const start =
    row?.started_at ?? row?.starts_at ?? null;
  const end =
    row?.ends_at ?? row?.expires_at ?? null;

  if (!start || !end) return false;

  const now = Date.now();
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();

  if (!Number.isFinite(s) || !Number.isFinite(e)) return false;
  return now >= s && now <= e;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const fid = Number(body?.fid);
    const kind = body?.kind;

    // 1️⃣ validate input
    if (!fid || !kind || !BOOST_DURATION[kind]) {
      return NextResponse.json(
        { error: "Invalid fid or boost kind" },
        { status: 400 }
      );
    }

    // 2️⃣ load user
    const user = await getUserByFid(fid);
    if (!user || !user.id) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // 3️⃣ check existing boosts (prevent overlap)
    const { data: existingBoosts, error: fetchError } =
      await supabaseAdmin
        .from("user_boosts")
        .select("*")
        .eq("user_id", user.id);

    if (fetchError) {
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500 }
      );
    }

    if (existingBoosts && existingBoosts.length > 0) {
      const hasActive = existingBoosts.some(isBoostRowActive);
      if (hasActive) {
        return NextResponse.json(
          { error: "Boost already active" },
          { status: 400 }
        );
      }
    }

    // 4️⃣ build time window
    const now = new Date();
    const endsAt = new Date(now.getTime() + BOOST_DURATION[kind]);

    // 5️⃣ try schema variants (boost type column)
    const payloadVariants = [
      {
        user_id: user.id,
        kind,
        started_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
      },
      {
        user_id: user.id,
        type: kind,
        started_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
      },
      {
        user_id: user.id,
        boost_type: kind,
        started_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
      },
    ];

    let lastError: any = null;

    for (const payload of payloadVariants) {
      const { error } = await supabaseAdmin
        .from("user_boosts")
        .insert(payload);

      if (!error) {
        return NextResponse.json({
          ok: true,
          fid,
          boost: kind,
          started_at: payload.started_at,
          ends_at: payload.ends_at,
          used_columns: Object.keys(payload),
        });
      }

      lastError = error;
    }

    return NextResponse.json(
      {
        error: "Failed to activate boost",
        detail: lastError?.message,
      },
      { status: 500 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: "Unexpected error", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
