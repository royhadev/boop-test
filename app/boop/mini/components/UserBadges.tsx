'use client'

type Props = { badges?: string[] }

export function UserBadges({ badges }: Props) {
  if (!badges || badges.length === 0) return null
  const unique = Array.from(new Set(badges))

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {unique.map((b) => (
        <span
          key={b}
          style={{
            fontSize: 12,
            padding: '4px 8px',
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.06)',
          }}
        >
          {b}
        </span>
      ))}
    </div>
  )
}
