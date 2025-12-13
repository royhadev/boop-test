// app/boop/mini/layout.tsx
import Link from 'next/link'

export default function MiniLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-[420px] px-4 py-6">
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10" />
              <div>
                <div className="text-sm font-semibold text-yellow-300">BoopApp</div>
                <div className="text-xs text-white/60">Miniapp • Engage • Earn</div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-4 text-sm">
            <Link className="text-white/70 hover:text-white" href="/boop/mini">
              Home
            </Link>
            <Link className="text-white/70 hover:text-white" href="/boop/mini/stake">
              Stake
            </Link>
            <Link className="text-white/70 hover:text-white" href="/boop/mini/withdraw">
              Withdraw
            </Link>
            <Link className="text-white/70 hover:text-white" href="/boop/mini/leaderboard">
              Leaderboard
            </Link>
          </div>
        </div>

        {children}

        <div className="mt-8 text-center text-xs text-white/40">
          BOOP on Base • XP • Levels • Missions • Rewards
        </div>
      </div>
    </div>
  )
}
