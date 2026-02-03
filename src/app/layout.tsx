import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LifeOS',
  description: 'Personal ops dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="antialiased bg-[var(--bg)] text-[var(--fg)]">{children}</body>
    </html>
  )
}
