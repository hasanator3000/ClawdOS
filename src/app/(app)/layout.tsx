import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout'
import { ShellWrapper } from '@/components/shell'
import { getSession } from '@/lib/auth/session'

// Layout is kept as stable as possible for snappy client-side navigation.

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session.userId) redirect('/login')

  return (
    <ShellWrapper>
      <Sidebar />
      <main className="flex-1 p-6 bg-[var(--bg)] text-[var(--fg)]">{children}</main>
    </ShellWrapper>
  )
}
