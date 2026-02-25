import type { Metadata } from 'next'
import { Outfit, Space_Mono } from 'next/font/google'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BuildGuard } from '@/components/system/BuildGuard'
import './globals.css'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
})

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-space-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ClawdOS',
  description: 'Personal ops dashboard',
}

function getBuildId(): string {
  try {
    return readFileSync(join(process.cwd(), '.next', 'BUILD_ID'), 'utf8').trim()
  } catch {
    return 'unknown'
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const buildId = getBuildId()

  return (
    <html lang="ru" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${outfit.variable} ${spaceMono.variable} antialiased bg-[var(--bg)] text-[var(--fg)]`}>
        <div className="bg-mesh" />
        {children}
        <BuildGuard buildId={buildId} />
      </body>
    </html>
  )
}
