'use client'

import { useState } from 'react'
import Image from 'next/image'

type NeynarAuthButtonProps = {
  username?: string
  displayName?: string
  avatarUrl?: string
}

/**
 * نسخه‌ی DEV از دکمه لاگین Neynar.
 * 
 * ساختار این کامپوننت کاملاً مشابه نسخه‌ی واقعی Neynar خواهد بود:
 * - جایگزینی login/logout واقعی فقط با 1 تابع انجام می‌شود.
 * - UI کامل و حرفه‌ای، بدون وابستگی به API
 * - Sign out فعلاً فقط پاپ‌آپ را می‌بندد (no-op)
 */
export function NeynarAuthButton({
  username = 'bargs',
  displayName = 'bargs',
  avatarUrl,
}: NeynarAuthButtonProps) {
  const [open, setOpen] = useState(false)

  const firstLetter =
    displayName && displayName.length > 0
      ? displayName[0]?.toUpperCase()
      : 'B'

  return (
    <div className="relative">
      {/* چیپ پروفایل */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full bg-slate-900/90 border border-slate-700 px-3 py-1 text-xs text-slate-100 hover:border-yellow-300 transition-colors"
      >
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-yellow-400 text-black font-semibold text-xs overflow-hidden">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={displayName}
              width={28}
              height={28}
              className="object-cover"
            />
          ) : (
            firstLetter
          )}
        </span>
        <span>@{username}</span>
      </button>

      {/* منوی پاپ‌آپ */}
      {open && (
        <div className="absolute right-0 mt-2 w-40 rounded-2xl bg-slate-950/95 border border-slate-700 shadow-lg p-3 text-xs text-slate-100 z-50">
          {/* پروفایل کوچک */}
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-yellow-400 text-black font-semibold text-xs overflow-hidden">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={displayName}
                  width={28}
                  height={28}
                  className="object-cover"
                />
              ) : (
                firstLetter
              )}
            </span>
            <div className="flex flex-col">
              <span className="font-semibold text-[11px]">
                @{username}
              </span>
              <span className="text-[10px] text-slate-400">
                Logged in (dev)
              </span>
            </div>
          </div>

          {/* دکمه خروج - فعلاً فقط UI */}
          <button
            type="button"
            className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 py-1.5 text-[11px] font-medium"
            onClick={() => {
              // در نسخه واقعی، اینجا logout واقعی صدا زده می‌شود.
              // فعلاً فقط UI را می‌بندیم.
              setOpen(false)
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
