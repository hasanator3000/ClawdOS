import { getSession } from '@/lib/auth/session'
import { getActiveWorkspace } from '@/lib/workspace'
import { withUser } from '@/lib/db'
import { findDeliveriesByWorkspace } from '@/lib/db/repositories/delivery.repository'
import { redirect } from 'next/navigation'
import { DeliveryList } from './DeliveryList'

export const dynamic = 'force-dynamic'

export default async function DeliveriesPage() {
  const [session, workspace] = await Promise.all([
    getSession(),
    getActiveWorkspace(),
  ])

  if (!session.userId) redirect('/login')

  if (!workspace) {
    return (
      <div className="p-6">
        <div className="text-center text-[var(--muted)]">Select a workspace to view deliveries</div>
      </div>
    )
  }

  const deliveries = await withUser(session.userId, async (client) => {
    return findDeliveriesByWorkspace(client, workspace.id, { limit: 100 })
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Deliveries</h1>
      </div>

      <DeliveryList initialDeliveries={deliveries} />
    </div>
  )
}
