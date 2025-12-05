// lib/neynar.ts
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY
const NEYNAR_API_BASE_URL =
  process.env.NEYNAR_API_BASE_URL || 'https://api.neynar.com/v2'

if (!NEYNAR_API_KEY) {
  console.warn(
    'Warning: NEYNAR_API_KEY is not set. Farcaster integration will not work properly.'
  )
}

export type FarcasterUser = {
  fid: number
  username: string | null
  displayName: string | null
  pfpUrl: string | null
}

export async function fetchFarcasterUserByFid(
  fid: number
): Promise<FarcasterUser | null> {
  if (!NEYNAR_API_KEY) {
    console.error('NEYNAR_API_KEY is missing')
    return null
  }

  const url = `${NEYNAR_API_BASE_URL}/farcaster/user/bulk?fids=${fid}`

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      api_key: NEYNAR_API_KEY,
    },
  })

  if (!res.ok) {
    console.error('Neynar user fetch failed', res.status, await res.text())
    return null
  }

  const json = await res.json().catch(() => null)
  if (!json || !Array.isArray(json.users) || json.users.length === 0) {
    console.error('No user found for fid', fid)
    return null
  }

  const u = json.users[0]

  return {
    fid: u.fid,
    username: u.username || null,
    displayName: u.display_name || null,
    pfpUrl:
      u.pfp_url ||
      (u.pfp && (u.pfp.url as string | undefined)) ||
      null,
  }
}
