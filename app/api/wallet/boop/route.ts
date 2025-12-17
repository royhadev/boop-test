// app/api/wallet/boop/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";

const BOOP_TOKEN_ADDRESS = process.env.BOOP_TOKEN_ADDRESS as `0x${string}` | undefined;
const BASE_RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";

// Minimal ERC20 ABI
const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

function isAddress(v: string): v is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const fid = Number(url.searchParams.get("fid") || 0);

    if (!fid || !Number.isFinite(fid)) {
      return NextResponse.json({ ok: false, error: "Missing fid" }, { status: 400 });
    }

    if (!BOOP_TOKEN_ADDRESS || !isAddress(BOOP_TOKEN_ADDRESS)) {
      return NextResponse.json(
        { ok: false, error: "Missing/invalid BOOP_TOKEN_ADDRESS env" },
        { status: 500 }
      );
    }

    // 1) find user + custody address
    const { data: user, error: uErr } = await supabaseAdmin
      .from("users")
      .select("id, fid, custody_address")
      .eq("fid", fid)
      .single();

    if (uErr || !user) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    const addrRaw = String(user.custody_address || "").trim();
    if (!addrRaw || !isAddress(addrRaw)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Missing custody_address on user. Add users.custody_address and store it on init/login.",
        },
        { status: 404 }
      );
    }

    const address = addrRaw as `0x${string}`;

    // 2) read BOOP balance on Base
    const client = createPublicClient({
      chain: base,
      transport: http(BASE_RPC_URL),
    });

    const decimals = await client.readContract({
      address: BOOP_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: "decimals",
    });

    const bal = await client.readContract({
      address: BOOP_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address],
    });

    const boopBalance = Number(formatUnits(bal, decimals));

    return NextResponse.json({
      ok: true,
      fid,
      address,
      boopBalance,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "wallet boop balance failed" },
      { status: 500 }
    );
  }
}
