'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { NeynarAuthButton } from '@/components/NeynarAuthButton'

export function Header() {
  const pathname = usePathname()

  // ❌ روی مسیرهای مینی‌اپ (داخل Farcaster) هِدر را کلاً مخفی کن
  if (pathname?.startsWith('/boop/mini')) {
    return null
  }

  // ✅ روی بقیه صفحات، هدر معمولی نمایش داده می‌شود
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 px-4 py-3 flex items-center justify-between bg-black/80 backdrop-blur">
      {/* Left: logo + title */}
      <Link href="/" className="flex items-center gap-2">
        <div className="relative h-9 w-9 rounded-2xl overflow-hidden shadow-[0_0_12px_rgba(250,204,21,0.7)] bg-black">
          <Image
            src="/boop-app-logo.png"
            alt="Boop App Logo"
            fill
            className="object-contain"
          />
        </div>
        <div className="text-lg font-semibold">
          BOOP <span className="text-yellow-300">Miniapp</span>
        </div>
      </Link>

      {/* Right: nav + auth */}
      <div className="flex items-center gap-6">
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="hover:text-yellow-300 text-slate-200">
            Home
          </Link>
          <Link href="/stake" className="hover:text-yellow-300 text-slate-200">
            Stake
          </Link>
          <Link
            href="/profile"
            className="hover:text-yellow-300 text-slate-200"
          >
            Profile
          </Link>
        </nav>

        <NeynarAuthButton />
      </div>
    </header>
  )
}
