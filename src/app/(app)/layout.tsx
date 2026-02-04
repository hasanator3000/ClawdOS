import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { getSession } from '@/lib/session'

// Layout is kept as stable as possible for snappy client-side navigation.

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session.userId) redirect('/login')

  return (
    <div className="min-h-screen flex bg-[var(--bg)] text-[var(--fg)]">
      <Sidebar />
      <main className="flex-1 p-6 bg-[var(--bg)] text-[var(--fg)]">{children}</main>
    </div>
  )
}
