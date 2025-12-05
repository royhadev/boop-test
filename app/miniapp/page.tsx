'use client'

import { useEffect, useState } from 'react'

type BoopUser = {
  id: string
  username: string
  xp: number
  level: number
  daily_streak: number
  created_at: string
  updated_at: string
  last_daily_claim: string | null
  fid: number | null
  pfp: string | null
}

export default function MiniappPage() {
  const [user, setUser] = useState<BoopUser | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 🔹 فعلاً مقدار تستی، بعداً از Neynar میاد
  const testFid = 12345
  const testUsername = 'testuser'
  const testPfp = ''

  const initUser = async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch('/api/user/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fid: testFid,
          username: testUsername,
          pfp: testPfp,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'Failed to init user')
        return
      }

      setUser(json.user)
    } catch (err) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  // 🔹 یک‌بار هنگام لود صفحه، کاربر رو init می‌کنیم
  useEffect(() => {
    initUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#050816',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        padding: '16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#0f172a',
          borderRadius: '24px',
          padding: '20px 20px 24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          border: '1px solid rgba(148,163,184,0.3)',
        }}
      >
        <h1
          style={{
            fontSize: '20px',
            fontWeight: 700,
            marginBottom: '4px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>BOOP Miniapp</span>
          <span
            style={{
              fontSize: '12px',
              padding: '2px 8px',
              borderRadius: '999px',
              background: 'rgba(34,197,94,0.15)',
              color: '#4ade80',
              border: '1px solid rgba(34,197,94,0.3)',
            }}
          >
            dev mode
          </span>
        </h1>
        <p
          style={{
            fontSize: '12px',
            color: '#9ca3af',
            marginBottom: '16px',
          }}
        >
          این صفحه فقط برای تست اتصال Miniapp به Supabase است.
        </p>

        {loading && (
          <div
            style={{
              padding: '12px',
              borderRadius: '16px',
              background: 'rgba(15,23,42,0.8)',
              border: '1px solid rgba(148,163,184,0.4)',
              fontSize: '13px',
            }}
          >
            در حال بارگذاری پروفایل کاربر...
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '12px',
              borderRadius: '16px',
              background: 'rgba(127,29,29,0.8)',
              border: '1px solid rgba(248,113,113,0.7)',
              fontSize: '13px',
              marginBottom: '12px',
            }}
          >
            خطا: {error}
          </div>
        )}

        {user && (
          <div
            style={{
              padding: '14px',
              borderRadius: '18px',
              background:
                'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(56,189,248,0.08))',
              border: '1px solid rgba(59,130,246,0.5)',
              marginBottom: '12px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '13px',
                    color: '#9ca3af',
                    marginBottom: '2px',
                  }}
                >
                  کاربر
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700 }}>
                  {user.username}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: '#9ca3af',
                    marginTop: '2px',
                  }}
                >
                  FID: {user.fid}
                </div>
              </div>
              <div
                style={{
                  textAlign: 'right',
                  fontSize: '12px',
                  color: '#e5e7eb',
                }}
              >
                <div>Level: {user.level}</div>
                <div>XP: {user.xp}</div>
                <div>Streak: {user.daily_streak} 🔥</div>
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={initUser}
          style={{
            marginTop: '8px',
            width: '100%',
            padding: '10px 12px',
            borderRadius: '999px',
            border: 'none',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            background:
              'linear-gradient(135deg, rgb(59,130,246), rgb(147,51,234))',
            color: '#fff',
          }}
        >
          {user ? 'Reload user from Supabase' : 'Init user در Supabase'}
        </button>
      </div>
    </div>
  )
}
