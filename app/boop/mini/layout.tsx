'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { NeynarAuthButton } from '@/components/NeynarAuthButton';

export default function MiniLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // برای اینکه fid و بقیه پارامترها بین تب‌ها حفظ بشن
  const qs = searchParams.toString();
  const suffix = qs ? `?${qs}` : '';

  const tabs = [
    { path: '/boop/mini', label: 'Home', href: `/boop/mini${suffix}` },
    { path: '/boop/mini/stake', label: 'Stake', href: `/boop/mini/stake${suffix}` },
    { path: '/boop/mini/withdraw', label: 'Withdraw', href: `/boop/mini/withdraw${suffix}` },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 px-3 py-4">
      {/* قاب موبایل مثل eggs */}
      <div className="w-full max-w-sm h-[720px] sm:h-[780px] rounded-[32px] border border-slate-800 bg-black shadow-[0_0_60px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col">
        {/* هدر اپ با لوگو + دکمه لاگین */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-gradient-to-r from-yellow-400/12 via-black to-black">
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 rounded-2xl overflow-hidden bg-black shadow-[0_0_18px_rgba(250,204,21,0.6)]">
              <Image
                src="/boop-miniapp-logo.png"
                alt="BoopApp Miniapp"
                fill
                className="object-contain"
              />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-yellow-300">
                BoopApp
              </span>
              <span className="text-[11px] text-slate-400">
                Miniapp · Engage → Earn
              </span>
            </div>
          </div>

          {/* دکمه Sign in با Farcaster */}
          <div className="flex items-center">
            <NeynarAuthButton />
          </div>
        </header>

        {/* تب‌های داخل miniapp (Home / Stake / Withdraw) */}
        <nav className="flex items-center justify-center gap-8 border-b border-slate-800 bg-black/95 px-4 py-2">
          {tabs.map((t) => {
            const isActive =
              pathname === t.path ||
              (t.path !== '/boop/mini' && pathname?.startsWith(t.path));

            return (
              <Link
                key={t.path}
                href={t.href}
                className={[
                  'text-xs font-medium transition px-1 pb-1',
                  isActive
                    ? 'text-yellow-300 border-b-2 border-yellow-300'
                    : 'text-slate-300 hover:text-white',
                ].join(' ')}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        {/* محتوای صفحات (Home / Stake / Withdraw) – قابل اسکرول داخل گوشی */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-950 via-slate-950 to-black">
          {children}
        </div>
      </div>
    </div>
  );
}
