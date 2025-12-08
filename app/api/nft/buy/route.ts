import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const NFT_TIER = 1;
// سقف تعداد NFT این کالکشن
const NFT_SUPPLY_CAP = 2000;
// قیمت دلاری NFT
const NFT_PRICE_USD = 100;

// ⚠️ فعلاً قیمت BOOP را ثابت در نظر می‌گیریم.
// بعد از لانچ، این تابع باید به یک price feed واقعی (DEX / Oracle) وصل شود.
async function getBoopPriceUsd(): Promise<number> {
  // TODO: replace with real on-chain / off-chain price feed
  const PRICE_USD = 0.0001; // قیمت موقت برای توسعه
  return PRICE_USD;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const fid = body?.fid as number | undefined;

    if (!fid) {
      return NextResponse.json(
        { error: "Missing fid in request body" },
        { status: 400 }
      );
    }

    // 1) پیدا کردن یوزر بر اساس fid
    const { data: user, error: userErr } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("fid", fid)
      .single();

    if (userErr || !user) {
      console.error("User lookup error:", userErr);
      return NextResponse.json(
        { error: "User not found for given fid" },
        { status: 404 }
      );
    }

    const userId = user.id as string;

    // 2) بررسی مجموع استیک کاربر (برای شرط 2,000,000 BOOP)
    const { data: stakes, error: stakesErr } = await supabaseAdmin
      .from("stakes")
      .select("staked_amount, status")
      .eq("user_id", userId)
      .eq("status", "active");

    if (stakesErr) {
      console.error("Fetch stakes error:", stakesErr);
      return NextResponse.json(
        { error: "Failed to fetch user stakes" },
        { status: 500 }
      );
    }

    let totalStaked = 0;
    if (stakes && stakes.length > 0) {
      totalStaked = stakes.reduce((sum, row) => {
        const amt = Number(row.staked_amount ?? 0);
        return sum + (Number.isNaN(amt) ? 0 : amt);
      }, 0);
    }

    // شرط حداقل استیک برای خرید و فعال بودن NFT
    const MIN_STAKE_FOR_NFT = 2_000_000;

    if (totalStaked < MIN_STAKE_FOR_NFT) {
      return NextResponse.json(
        {
          error:
            "Not enough staked BOOP to buy this NFT. Minimum required is 2,000,000 BOOP.",
          code: "INSUFFICIENT_STAKE",
          total_staked: totalStaked,
          required_min_stake: MIN_STAKE_FOR_NFT,
        },
        { status: 400 }
      );
    }

    // 3) چک کردن تعداد NFTهای موجود این tier (برای سقف 2000)
    const { count, error: countErr } = await supabaseAdmin
      .from("nft_ownership")
      .select("id", { count: "exact", head: true })
      .eq("nft_tier", NFT_TIER);

    if (countErr) {
      console.error("Count NFTs error:", countErr);
      return NextResponse.json(
        { error: "Failed to check NFT supply" },
        { status: 500 }
      );
    }

    const existingCount = count ?? 0;

    if (existingCount >= NFT_SUPPLY_CAP) {
      return NextResponse.json(
        {
          error: "All BOOP NFT Boosts are already minted",
          code: "NFT_SOLD_OUT",
        },
        { status: 400 }
      );
    }

    // شماره NFT بعدی (1 تا 2000)
    const nextTokenNumber = existingCount + 1;

    // 4) گرفتن قیمت لحظه‌ای BOOP (فعلاً ثابت؛ بعداً real-time)
    const currentPriceUsd = await getBoopPriceUsd();
    if (!currentPriceUsd || currentPriceUsd <= 0) {
      console.error("Invalid BOOP price in getBoopPriceUsd:", currentPriceUsd);
      return NextResponse.json(
        { error: "Invalid BOOP price" },
        { status: 500 }
      );
    }

    // قیمت NFT بر حسب BOOP = 100 دلار تقسیم بر قیمت لحظه‌ای
    const rawPriceBoops = NFT_PRICE_USD / currentPriceUsd;
    // کمی رند برای این‌که مقدار معقول باشه
    const priceBoops = Math.ceil(rawPriceBoops);

    // 5) محاسبه سهم Burn / خزانه / تیم (33 / 33 / 34)
    const burnBoopsRaw = priceBoops * 0.33;
    const treasuryBoopsRaw = priceBoops * 0.33;
    const teamBoopsRaw = priceBoops * 0.34;

    const burnBoops = Number(burnBoopsRaw.toFixed(6));
    const treasuryBoops = Number(treasuryBoopsRaw.toFixed(6));
    const teamBoops = Number(teamBoopsRaw.toFixed(6));

    // 6) ساخت ردیف NFT در nft_ownership
    const { data: nftRow, error: insertNftErr } = await supabaseAdmin
      .from("nft_ownership")
      .insert({
        user_id: userId,
        nft_tier: NFT_TIER,
        nft_token_number: nextTokenNumber,
        is_active: true,
        // برای مارکت‌پلیس:
        is_listed: false,
        listed_price_boops: null,
        market_status: "not_listed",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id, nft_tier, nft_token_number, created_at")
      .single();

    if (insertNftErr || !nftRow) {
      console.error("Insert NFT error:", insertNftErr);
      return NextResponse.json(
        { error: "Failed to mint NFT" },
        { status: 500 }
      );
    }

    // 7) ثبت درآمد در boop_transactions (خرید اولیه NFT)
    const { error: txErr } = await supabaseAdmin.from("boop_transactions").insert({
      user_id: userId,
      type: "nft_primary",
      amount_boops: priceBoops,
      amount_usd: NFT_PRICE_USD,
      burn_boops: burnBoops,
      treasury_boops: treasuryBoops,
      team_boops: teamBoops,
      metadata: {
        nft_tier: NFT_TIER,
        nft_token_number: nextTokenNumber,
        boop_price_usd: currentPriceUsd,
      },
    });

    if (txErr) {
      console.error("Insert boop_transactions error:", txErr);
      // NFT ساخته شده اما تراکنش لاگ نشده → می‌شه بعداً با job اصلاحش کرد
    }

    // 8) پاسخ موفقیت به کلاینت
    return NextResponse.json(
      {
        success: true,
        nft: {
          id: nftRow.id,
          tier: nftRow.nft_tier,
          token_number: nftRow.nft_token_number,
          created_at: nftRow.created_at,
        },
        pricing: {
          nft_price_usd: NFT_PRICE_USD,
          boop_price_usd: currentPriceUsd,
          price_boops: priceBoops,
        },
        split: {
          burn_boops: burnBoops,
          treasury_boops: treasuryBoops,
          team_boops: teamBoops,
        },
        stake_info: {
          total_staked: totalStaked,
          min_required: MIN_STAKE_FOR_NFT,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Unexpected error in /api/nft/buy:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
