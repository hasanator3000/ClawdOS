'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface QuickLink {
  href: string
  label: string
  icon: React.ReactNode
}

const defaultLinks: QuickLink[] = [
  {
    href: '/tasks',
    label: 'Tasks',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    href: '/news',
    label: 'News',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
        <path d="M18 14h-8" />
        <path d="M15 18h-5" />
        <path d="M10 6h8v4h-8V6Z" />
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    ),
  },
]

export function QuickLinksWidget() {
  const pathname = usePathname()

  return (
    <div
      className="p-4 rounded-2xl"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <div
        className="text-[10px] uppercase tracking-widest font-mono mb-3"
        style={{ color: 'var(--muted)' }}
      >
        Quick Access
      </div>
      <div className="grid grid-cols-3 gap-3">
        {defaultLinks.map((link) => {
          const isActive = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex flex-col items-center justify-center p-4 rounded-xl transition-all"
              style={{
                background: isActive ? 'var(--neon-dim)' : 'var(--surface)',
                border: `1px solid ${isActive ? 'var(--neon)' : 'var(--border)'}`,
                color: isActive ? 'var(--neon)' : 'var(--muted)',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--neon)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--muted)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }
              }}
            >
              {link.icon}
              <span className="mt-2 text-sm font-medium">{link.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
